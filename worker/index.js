// 読まれ方の計測。匿名の集計だけを D1 に残す(Cookie なし・IP なし・端末の情報なし)。
// 静的ファイルの配信は Cloudflare に任せ、/api/* だけをここで受ける(wrangler.jsonc の run_worker_first)。
// 残すのは「どのページで、何秒、見出しをいくつ読み進めたか」「記事末のボタンの選択」だけ。
// 診断の回答は、好みの傾向を知るために匿名で集める(選んだ内容と、出たビール名、日付と時間だけ)。
// 同じ人を、別の日・別のタブにまたいで結びつける ID は持たない。
//   vid = 読み込みごとの使い捨て(同じ読み込みの重複を1件にまとめるだけ)
//   sid = そのタブを閉じれば消える使い捨て(sessionStorage。Cookie ではない)。同じタブでの「ページの順路」を見るためだけ。
//         保存は90日まで(それを過ぎたら sid を消して、順路は集計だけ残す)。IP・端末の情報とは一緒に持たない
// 遷移(どのページから来たか)は、直前のページのパスか、外から来たときはドメイン名だけを記録する。

import GBP from './gbp-data.json'; // ビルドが作る(scripts/build.mjs)。Git には入れない

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
const VOICE_CATS = new Set(['learn', 'beer', 'site', 'yagiriya']);
const VOICE_DAILY_MAX = 300; // 1日の受付の上限(IP を取らないので、荒らされたときの歯止めは全体の件数で持つ)
const TOP_RE = /^[\p{L}\p{N} ._\-・&'()]{1,40}$/u;
// 気象の観測点は、松戸市の中心に最も近く、気温を観測している AMeDAS の地点を自動で選ぶ(利用者の居場所は取らない)
const MATSUDO = { lat: 35.787, lon: 139.903 };
const JMA = 'https://www.jma.go.jp/bosai/amedas/';
const REF_RE = /^[a-z0-9._\-/]{1,120}$/;
const CLICK_KINDS = new Set(['shop', 'ig', 'fund', 'map', 'tel', 'ext']);
const SID_KEEP_DAYS = 90;
const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

let ready; // 表は初回のアクセスで作る(導入時にマイグレーションの手順を挟まないため)
const ensureSchema = (db) => (ready ??= db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS visits (vid TEXT PRIMARY KEY, day TEXT NOT NULL, path TEXT NOT NULL, secs INTEGER NOT NULL, reached INTEGER NOT NULL, total INTEGER NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS visits_path_day ON visits (path, day)'),
  db.prepare('CREATE TABLE IF NOT EXISTS votes (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, path TEXT NOT NULL, choice TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS votes_path ON votes (path, choice)'),
  db.prepare('CREATE TABLE IF NOT EXISTS finder (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, hour INTEGER NOT NULL, mood TEXT NOT NULL, purpose TEXT NOT NULL, bitter TEXT NOT NULL, likes TEXT NOT NULL, exp TEXT NOT NULL, top TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS finder_day ON finder (day, hour)'),
  db.prepare('CREATE TABLE IF NOT EXISTS voice (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, path TEXT NOT NULL, cat TEXT NOT NULL, msg TEXT NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, path TEXT NOT NULL, kind TEXT NOT NULL, sid TEXT)'),
  db.prepare('CREATE TABLE IF NOT EXISTS weather (day TEXT NOT NULL, hour INTEGER NOT NULL, temp REAL, precip REAL, humidity INTEGER, station TEXT, PRIMARY KEY (day, hour))'),
]).then(async () => {
  // 後から足した列(すでにある DB には ALTER で足す。2回目以降は「列が既にある」で失敗するので無視する)
  for (const col of ['ts INTEGER', 'sid TEXT', 'rk TEXT', 'rv TEXT']) await db.prepare(`ALTER TABLE visits ADD COLUMN ${col}`).run().catch(() => {});
  for (const col of ['ts INTEGER', 'sid TEXT']) await db.prepare(`ALTER TABLE finder ADD COLUMN ${col}`).run().catch(() => {});
}).catch((e) => { ready = undefined; throw e; }));

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
    const sid = typeof b.sid === 'string' && VID_RE.test(b.sid) ? b.sid : null;
    const rkOk = (b.rk === 'in' && PATH_RE.test(b.rv ?? '')) || ((b.rk === 'ext' || b.rk === 'from') && typeof b.rv === 'string' && REF_RE.test(b.rv));
    await env.DB.prepare('INSERT INTO visits (vid, day, path, secs, reached, total, ts, sid, rk, rv) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ON CONFLICT(vid) DO UPDATE SET secs = MAX(secs, ?4), reached = MAX(reached, ?5)')
      .bind(b.vid, dayJst(), b.path, secs, reached, total, Math.floor(Date.now() / 1000), sid, rkOk ? b.rk : null, rkOk ? b.rv : null).run();
    return reply(204);
  }
  if (b.t === 'click' && CLICK_KINDS.has(b.kind)) {
    const sid = typeof b.sid === 'string' && VID_RE.test(b.sid) ? b.sid : null;
    await env.DB.prepare('INSERT INTO clicks (day, path, kind, sid) VALUES (?1, ?2, ?3, ?4)').bind(dayJst(), b.path, b.kind, sid).run();
    return reply(204);
  }
  if (b.t === 'vote' && CHOICES.has(b.choice)) {
    await env.DB.prepare('INSERT INTO votes (day, path, choice) VALUES (?1, ?2, ?3)').bind(dayJst(), b.path, b.choice).run();
    return reply(204);
  }
  if (b.t === 'finder' && b.a && typeof b.a === 'object' && typeof b.top === 'string' && TOP_RE.test(b.top)
    && Object.keys(FINDER).every((k) => FINDER[k].includes(b.a[k]))) {
    const sid = typeof b.sid === 'string' && VID_RE.test(b.sid) ? b.sid : null; // 同じタブで先に読んだページと、診断の結果を、つなげて見るため(90日で消す)
    await env.DB.prepare('INSERT INTO finder (day, hour, mood, purpose, bitter, likes, exp, top, ts, sid) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)')
      .bind(dayJst(), jst().getUTCHours(), b.a.mood, b.a.purpose, b.a.bitter, b.a.likes, b.a.exp, b.top, Math.floor(Date.now() / 1000), sid).run();
    return reply(204);
  }
  return reply(400);
}

// ---- ご意見箱。計測と違い、送れなかったときは正直に失敗を返す(「送れた」と見せかけない)
async function voice(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return reply(403);
  const raw = await request.text();
  if (raw.length > 4096) return reply(413);
  let b;
  try { b = JSON.parse(raw); } catch { return reply(400); }
  if (!b || typeof b.path !== 'string' || !PATH_RE.test(b.path) || !VOICE_CATS.has(b.cat) || typeof b.msg !== 'string') return reply(400);
  // 自動入力(人が見ない欄に値がある/表示から3秒未満の送信)は、受けたふりをして捨てる
  if (b.hp || !(b.ms >= 3000)) return reply(204);
  const msg = b.msg.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (msg.length < 5 || msg.length > 500) return reply(400);
  await ensureSchema(env.DB);
  const day = dayJst();
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM voice WHERE day = ?1').bind(day).first()).n;
  if (n >= VOICE_DAILY_MAX) return reply(429);
  await env.DB.prepare('INSERT INTO voice (day, path, cat, msg) VALUES (?1, ?2, ?3, ?4)').bind(day, b.path, b.cat, msg).run();
  return reply(204);
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

// ---- 順路の識別(sid)は90日で消す。集計(遷移・クリックの件数)はそのまま残る
async function dropOldSid(env) {
  await ensureSchema(env.DB);
  const cut = new Date(Date.now() + 9 * 3600 * 1000 - SID_KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  await env.DB.batch([env.DB.prepare('UPDATE visits SET sid = NULL WHERE day < ?1 AND sid IS NOT NULL').bind(cut), env.DB.prepare('UPDATE clicks SET sid = NULL WHERE day < ?1 AND sid IS NOT NULL').bind(cut), env.DB.prepare('UPDATE finder SET sid = NULL WHERE day < ?1 AND sid IS NOT NULL').bind(cut)]);
}

// ---- 管理者用の集計(STATS_TOKEN を Cloudflare のシークレットに入れたときだけ開く)
// 同じタブで見た順路(sid ごと)を、上位だけ件数で返す。sid そのものは返さない
async function routes(db) {
  const rows = (await db.prepare('SELECT sid, path FROM visits WHERE sid IS NOT NULL ORDER BY sid, ts LIMIT 5000').all()).results;
  const by = new Map();
  for (const r of rows) { const a = by.get(r.sid) ?? []; if (a[a.length - 1] !== r.path) a.push(r.path); by.set(r.sid, a); }
  const cnt = new Map();
  for (const a of by.values()) if (a.length >= 2) { const k = a.slice(0, 6).join(' → '); cnt.set(k, (cnt.get(k) ?? 0) + 1); }
  return [...cnt.entries()].sort((x, y) => y[1] - x[1]).slice(0, 30).map(([route, n]) => ({ route, n }));
}
// 合言葉の確認(集計と投稿文の下書きで共通)。通ったら null、通らなければ返す応答
function denied(request, env) {
  // 未登録は 503(Worker は動いているが合言葉が見えていない)。静的ファイルの 404 と見分けるため、404 にしない
  if (!env.STATS_TOKEN) {
    // 名前の打ち間違い(空白・全角・大小文字)を見つけるため、STAT/TOKEN を含む名前だけを返す(値は返さない)
    const near = Object.keys(env).filter((k) => /stat|token/i.test(k));
    return new Response(JSON.stringify({ near }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  return (request.headers.get('Authorization') || '') === 'Bearer ' + env.STATS_TOKEN ? null : reply(401);
}
function gbp(request, env) {
  const d = denied(request, env);
  if (d) return d;
  return new Response(JSON.stringify(GBP), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
async function stats(request, env) {
  // 未登録は 503(Worker は動いているが合言葉が見えていない)。静的ファイルの 404 と見分けるため、404 にしない
  if (!env.STATS_TOKEN) {
    // 名前の打ち間違い(空白・全角・大小文字)を見つけるため、STAT/TOKEN を含む名前だけを返す(値は返さない)
    const near = Object.keys(env).filter((k) => /stat|token/i.test(k));
    return new Response(JSON.stringify({ near }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
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
    // 単純なアクセス数(1回のページの読み込み=1件)。日付は日本時間。tabs は、同じタブで見た印(sid)の数=おおよその訪問数
    daily: await q('SELECT day, COUNT(*) AS pv, COUNT(DISTINCT sid) AS tabs FROM visits GROUP BY day ORDER BY day DESC LIMIT 60'),
    hourly: await q("SELECT CAST(strftime('%H', ts + 32400, 'unixepoch') AS INTEGER) AS h, COUNT(*) AS n FROM visits WHERE ts IS NOT NULL AND ts >= CAST(strftime('%s', 'now') AS INTEGER) - 30 * 86400 GROUP BY h ORDER BY h"),
    weekday: await q("SELECT CAST(strftime('%w', day) AS INTEGER) AS w, COUNT(*) AS n, COUNT(DISTINCT day) AS days FROM visits WHERE day >= date('now', '+9 hours', '-90 days') GROUP BY w ORDER BY w"),
    heat: await q("SELECT strftime('%Y-%m-%d', ts + 32400, 'unixepoch') AS day, CAST(strftime('%H', ts + 32400, 'unixepoch') AS INTEGER) AS h, COUNT(*) AS n FROM visits WHERE ts IS NOT NULL AND ts >= CAST(strftime('%s', 'now') AS INTEGER) - 14 * 86400 GROUP BY day, h ORDER BY day DESC, h"),
    flows: await q("SELECT rv AS src, path AS dst, COUNT(*) AS n FROM visits WHERE rk = 'in' AND rv != path GROUP BY rv, path ORDER BY n DESC LIMIT 50"),
    entries: await q("SELECT COALESCE(rk, 'direct') AS kind, COALESCE(rv, '') AS val, COUNT(*) AS n FROM visits GROUP BY rk, rv HAVING kind != 'in' ORDER BY n DESC LIMIT 40"),
    clicks: await q('SELECT path, kind, COUNT(*) AS n FROM clicks GROUP BY path, kind ORDER BY n DESC LIMIT 60'),
    routes: await routes(env.DB),
    direct_pages: await q("SELECT path, COUNT(*) AS n FROM visits WHERE rk IS NULL GROUP BY path ORDER BY n DESC LIMIT 20"),
    finder_reads: await q("SELECT f.top AS top, v.path AS path, COUNT(DISTINCT f.id) AS n FROM finder f JOIN visits v ON v.sid = f.sid AND v.ts <= f.ts WHERE f.sid IS NOT NULL AND v.path LIKE '/journal/%' GROUP BY f.top, v.path ORDER BY n DESC LIMIT 60"),
    finder_with_sid: (await q('SELECT COUNT(*) AS n, SUM(sid IS NOT NULL) AS s FROM finder'))[0],
    voice: await q('SELECT id, day, path, cat, msg FROM voice ORDER BY id DESC LIMIT 200'),
    weather_rows: (await q('SELECT COUNT(*) AS n FROM weather'))[0].n,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(recordWeather(env).catch(() => { /* 取れない時間があっても、次の回で取る */ }));
    ctx.waitUntil(dropOldSid(env).catch(() => {}));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/e') {
      if (request.method !== 'POST') return reply(405);
      // 計測の失敗でページの表示に影響を出さない(失敗は 204 で黙って返す。画面に何も出さない)
      try { return await collect(request, env); } catch { return reply(204); }
    }
    if (url.pathname === '/api/voice') {
      if (request.method !== 'POST') return reply(405);
      try { return await voice(request, env); } catch { return reply(500); }
    }
    if (url.pathname === '/api/gbp') return request.method === 'GET' ? gbp(request, env) : reply(405);
    if (url.pathname === '/api/stats') return request.method === 'GET' ? stats(request, env) : reply(405);
    return env.ASSETS.fetch(request);
  },
};
