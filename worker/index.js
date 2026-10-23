// 読まれ方の計測。匿名の集計だけを D1 に残す(Cookie なし・IP なし・端末の情報なし)。
// 静的ファイルの配信は Cloudflare に任せ、/api/* だけをここで受ける(wrangler.jsonc の run_worker_first)。
// 残すのは「どのページで、何秒、見出しをいくつ読み進めたか」「記事末のボタンの選択」だけ。
// 同じ人の別ページを結びつける ID は持たない(vid は読み込みごとの使い捨て。同じ読み込みの重複を1件にまとめるためだけ)。

const PATH_RE = /^\/[a-z0-9\-_/]{0,120}$/;
const VID_RE = /^[a-z0-9]{8,24}$/;
const CHOICES = new Set(['good', 'more', 'off']);
const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

let ready; // 表は初回のアクセスで作る(導入時にマイグレーションの手順を挟まないため)
const ensureSchema = (db) => (ready ??= db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS visits (vid TEXT PRIMARY KEY, day TEXT NOT NULL, path TEXT NOT NULL, secs INTEGER NOT NULL, reached INTEGER NOT NULL, total INTEGER NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS visits_path_day ON visits (path, day)'),
  db.prepare('CREATE TABLE IF NOT EXISTS votes (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, path TEXT NOT NULL, choice TEXT NOT NULL)'),
  db.prepare('CREATE INDEX IF NOT EXISTS votes_path ON votes (path, choice)'),
]).catch((e) => { ready = undefined; throw e; }));

// 日付は日本時間の暦日(UTC のままだと、朝9時前の分が前日に入る)
const dayJst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

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
  return reply(400);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/e') {
      if (request.method !== 'POST') return reply(405);
      // 計測の失敗でページの表示に影響を出さない(失敗は 204 で黙って返す。画面に何も出さない)
      try { return await collect(request, env); } catch { return reply(204); }
    }
    return env.ASSETS.fetch(request);
  },
};
