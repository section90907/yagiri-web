// 読まれ方の計測。匿名の集計だけを D1 に残す(Cookie なし・IP なし・端末の情報なし)。
// 静的ファイルの配信は Cloudflare に任せ、/api/* だけをここで受ける(wrangler.jsonc の run_worker_first)。
// 残すのは「どのページで、何秒、見出しをいくつ読み進めたか」「記事末のボタンの選択」だけ。
// 診断の回答は、好みの傾向を知るために匿名で集める(選んだ内容と、出たビール名、日付と時間だけ)。
// 同じ人の別ページを結びつける ID は持たない(vid は読み込みごとの使い捨て。同じ読み込みの重複を1件にまとめるためだけ)。

const PATH_RE = /^\/[a-z0-9\-_/]{0,120}$/;
const VID_RE = /^[a-z0-9]{8,24}$/;
const CHOICES = new Set(['good', 'more', 'off']);
// ビール診断の選択肢(src/partials/beer-finder.html の Q と同じ。外れた値は捨てる)
const FINDER = {
  mood: ['refresh', 'savor', 'adventure', 'fun'],
  purpose: ['thirst', 'pair', 'rich', 'light'],
  bitter: ['low', 'mid', 'high'],
  likes: ['classic', 'fruity', 'roasty', 'spicy', 'hoppy', 'any'],
  exp: ['rare', 'some', 'often'],
};
const TOP_RE = /^[\p{L}\p{N} ._\-・&'()]{1,40}$/u;
// 気象の観測点は、松戸市の中心に最も近く、気温を観測している AMeDAS の地点を自動で選ぶ(利用者の居場所は取らない)
const MATSUDO = { lat: 35.787, lon: 139.903 };
const JMA = 'https://www.jma.go.jp/bosai/amedas/';
const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

let ready; // 表は初回のアクセスで作る(導入時にマイグレーションの手順を挟まないため)
const ensureSchema = (db) => (ready ??= db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS visits (vid TEXT PRIMARY KEY, day TEXT NOT NULL, path TEXT NOT NULL, secs INTEGER NOT NULL, reached INTEGER NOT NULL, total INTEGER NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS visits_path_day ON visits (path, day)'),
  db.prepare('CREATE TABLE IF NOT EXISTS votes (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, path TEXT NOT NULL, choice TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS votes_path ON votes (path, choice)'),
  db.prepare('CREATE TABLE IF NOT EXISTS finder (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, hour INTEGER NOT NULL, mood TEXT NOT NULL, purpose TEXT NOT NULL, bitter TEXT NOT NULL, likes TEXT NOT NULL, exp TEXT NOT NULL, top TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS finder_day ON finder (day, hour)'),
  db.prepare('CREATE TABLE IF NOT EXISTS weather (day TEXT NOT NULL, hour INTEGER NOT NULL, temp REAL, precip REAL, humidity INTEGER, station TEXT, PRIMARY KEY (day, hour))'),
]).catch((e) => { ready = undefined; throw e; }));

// 日付は日本時間の暦日(UTC のままだと、朝9時前の分が前日に入る)
const jst = () => new Date(Date.now() + 9 * 3600 * 1000);
const dayJst = () => jst().toISOString().slice(0, 10);

const reply = (status) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

async function collect(request, env) {
  // 別のサイトからの書き込みを断る(同じ出所のページからだけ受ける)
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return reply(403);
  const raw = await request.text();
  if (raw.length > 1024) return reply(413);
  let b;
  try { b = JSON.parse(raw); } catch { return reply(400); }
  if (!b || typeof b.path !== 'string' || !PATH_RE.test(b.path)) return reply(400);
  await ensureSchema(env.DB);
  if (b.t === 'visit') {
    const secs = int(b.secs, 3600), reached = int(b.reached, 99), total = int(b.total, 99);
    if (secs === null || reached === null || total === null || reached > total || typeof b.vid !== 'string' || !VID_RE.test(b.vid)) return reply(400);
    await env.DB.prepare('INSERT INTO visits (vid, day, path, secs, reached, total) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(vid) DO UPDATE SET secs = MAX(secs, ?4), reached = MAX(reached, ?5)')
      .bind(b.vid, dayJst(), b.path, secs, reached, total).run();
    return reply(204);
  }
  if (b.t === 'vote' && CHOICES.has(b.choice)) {
    await env.DB.prepare('INSERT INTO votes (day, path, choice) VALUES (?1, ?2, ?3)').bind(dayJst(), b.path, b.choice).run();
    return reply(204);
  }
  if (b.t === 'finder' && b.a && typeof b.a === 'object' && typeof b.top === 'string' && TOP_RE.test(b.top)
    && Object.keys(FINDER).every((k) => FINDER[k].includes(b.a[k]))) {
    await env.DB.prepare('INSERT INTO finder (day, hour, mood, purpose, bitter, likes, exp, top) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
      .bind(dayJst(), jst().getUTCHours(), b.a.mood, b.a.purpose, b.a.bitter, b.a.likes, b.a.exp, b.top).run();
    return reply(204);
  }
  return reply(400);
}

// ---- 気象(1時間ごと)。診断や閲覧と、日付・時間で結びつけて「雨の日に何が選ばれるか」を見るため
const num = (v) => (Array.isArray(v) && typeof v[0] === 'number' ? v[0] : null);
async function jmaJson(path) {
  const r = await fetch(JMA + path, { cf: { cacheTtl: 300 } });
  if (!r.ok) throw new Error('jma ' + r.status);
  return r;
}
async function recordWeather(env) {
  await ensureSchema(env.DB);
  const latest = (await (await jmaJson('data/latest_time.txt')).text()).trim(); // 例 2026-10-24T09:50:00+09:00
  const stamp = latest.replace(/[-:T]/g, '').slice(0, 14); // 20261024095000
  const map = await (await jmaJson(`data/map/${stamp}.json`)).json();
  const table = await (await jmaJson('const/amedastable.json')).json();
  let best = null;
  for (const [id, o] of Object.entries(map)) {
    const t = table[id];
    if (!t || num(o.temp) === null || !Array.isArray(t.lat) || !Array.isArray(t.lon)) continue;
    const dLat = t.lat[0] + t.lat[1] / 60 - MATSUDO.lat, dLon = t.lon[0] + t.lon[1] / 60 - MATSUDO.lon;
    const d = dLat * dLat + dLon * dLon * 0.67; // 経度1度は緯度1度より短い(この緯度で約0.82倍。2乗で約0.67)
    if (!best || d < best.d) best = { id, d, name: t.kjName || id };
  }
  if (!best) return;
  const o = map[best.id];
  const when = new Date(Date.parse(latest)); // 観測時刻(JST の暦日と時を取り出す)
  const j = new Date(when.getTime() + 9 * 3600 * 1000);
  await env.DB.prepare('INSERT OR REPLACE INTO weather (day, hour, temp, precip, humidity, station) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(j.toISOString().slice(0, 10), j.getUTCHours(), num(o.temp), num(o.precipitation1h), num(o.humidity), best.name).run();
}

// ---- 管理者用の集計(STATS_TOKEN を Cloudflare のシークレットに入れたときだけ開く)
async function stats(request, env) {
  // 未登録は 503(Worker は動いているが合言葉が見えていない)。静的ファイルの 404 と見分けるため、404 にしない
  if (!env.STATS_TOKEN) return reply(503);
  const given = request.headers.get('Authorization') || '';
  if (given !== 'Bearer ' + env.STATS_TOKEN) return reply(401);
  await ensureSchema(env.DB);
  const q = async (sql) => (await env.DB.prepare(sql).all()).results;
  const body = {
    pages: await q('SELECT path, COUNT(*) AS n, ROUND(AVG(secs)) AS avg_secs, SUM(reached) AS reached, SUM(total) AS total FROM visits GROUP BY path ORDER BY n DESC LIMIT 100'),
    votes: await q('SELECT path, choice, COUNT(*) AS n FROM votes GROUP BY path, choice ORDER BY path'),
    finder: await q('SELECT mood, top, COUNT(*) AS n FROM finder GROUP BY mood, top ORDER BY n DESC LIMIT 100'),
    weather: await q(`SELECT CASE WHEN w.temp IS NULL THEN '気温不明' WHEN w.temp < 10 THEN '10℃未満' WHEN w.temp < 20 THEN '10〜19℃' WHEN w.temp < 28 THEN '20〜27℃' ELSE '28℃以上' END AS temp_band,
      CASE WHEN w.precip IS NULL THEN '降水不明' WHEN w.precip > 0 THEN '雨' ELSE '雨なし' END AS rain, f.top, COUNT(*) AS n
      FROM finder f LEFT JOIN weather w ON w.day = f.day AND w.hour = f.hour GROUP BY temp_band, rain, f.top ORDER BY temp_band, n DESC LIMIT 200`),
    weather_rows: (await q('SELECT COUNT(*) AS n FROM weather'))[0].n,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(recordWeather(env).catch(() => { /* 取れない時間があっても、次の回で取る */ }));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/e') {
      if (request.method !== 'POST') return reply(405);
      // 計測の失敗でページの表示に影響を出さない(失敗は 204 で黙って返す。画面に何も出さない)
      try { return await collect(request, env); } catch { return reply(204); }
    }
    if (url.pathname === '/api/stats') return request.method === 'GET' ? stats(request, env) : reply(405);
    return env.ASSETS.fetch(request);
  },
};
