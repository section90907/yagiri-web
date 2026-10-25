// 読まれ方の計測(匿名)。Cookie も localStorage の ID も使わない。送るのは
// 「ページのパス・見ていた秒数・見出しをいくつ読み進めたか」と、記事末のボタンの選択だけ。
(function () {
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  var path = location.pathname;
  if (!/^\/[a-z0-9\-_/]*$/.test(path) || path.indexOf('/api') === 0 || path.indexOf('/ops/') === 0) return;
  var send = function (o) {
    o.path = path;
    try { navigator.sendBeacon('/api/e', new Blob([JSON.stringify(o)], { type: 'application/json' })); } catch (e) { /* 計測は失敗しても何も出さない */ }
  };

  // ビール診断が使う(診断の完了時に、回答と出たビール名を送る)。DNT のときはここまで来ないので、送られない
  window.yagiriPulse = { finder: function (a, top) { send({ t: 'finder', a: a, top: String(top).slice(0, 40) }); } };

  // 見出し(h2)を何個、画面の上のほうまで読み進めたか
  var heads = [].slice.call(document.querySelectorAll('main h2, article h2')).filter(function (h) { return !h.closest('[data-voice]'); }); // ご意見箱の見出しは数えない
  var seen = 0;
  if (heads.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { seen++; io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -30% 0px' });
    heads.forEach(function (h) { io.observe(h); });
  }

  // 画面が前面にあった秒数。読み込みごとの使い捨ての印(vid)で、同じ読み込みの再送を1件にまとめる
  var vid = Math.random().toString(36).slice(2, 14) + Date.now().toString(36).slice(-4);
  var shown = document.visibilityState === 'visible' ? Date.now() : 0, acc = 0;
  var flush = function () {
    if (shown) { acc += Date.now() - shown; shown = 0; }
    var secs = Math.min(3600, Math.round(acc / 1000));
    send({ t: 'visit', vid: vid, secs: secs, reached: Math.min(seen, heads.length, 99), total: Math.min(heads.length, 99) });
  };
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(); else shown = Date.now();
  });
  window.addEventListener('pagehide', flush);

  // 読みもの(記事)の末尾に、3択のボタン。記事以外には出さない
  var prose = document.querySelector('article .prose');
  if (!prose || !prose.parentNode) return;
  var KEY = 'pv:' + path, done = false;
  try { done = !!localStorage.getItem(KEY); } catch (e) { /* 保存できなくても動く */ }
  var box = document.createElement('div');
  box.setAttribute('style', "margin-top:56px;border:1px solid #3A3A3A;padding:24px 28px;font-family:'Zen Kaku Gothic New',sans-serif;font-size:17px;line-height:1.9;color:#E6E0D2");
  var q = document.createElement('p'); q.setAttribute('style', 'margin:0 0 14px'); q.textContent = 'この記事は、いかがでしたか?';
  var row = document.createElement('div'); row.setAttribute('style', 'display:flex;flex-wrap:wrap;gap:12px');
  var note = document.createElement('p'); note.setAttribute('style', 'margin:14px 0 0;font-size:14px;color:#BDB7A9');
  note.textContent = '読まれ方は、個人を特定しない形で集計しています(Cookieなし)。';
  var thanks = function () { row.hidden = true; q.textContent = 'ありがとうございました。次の記事の参考にします。'; };
  [['good', '役に立った'], ['more', 'もっと知りたい'], ['off', 'ちょっと違う']].forEach(function (c) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = c[1];
    b.setAttribute('style', 'min-height:44px;padding:8px 20px;background:transparent;border:1px solid #C9AA6E;color:#E6E0D2;font:inherit;font-size:16px;cursor:pointer');
    b.addEventListener('click', function () {
      send({ t: 'vote', choice: c[0] });
      try { localStorage.setItem(KEY, '1'); } catch (e) { /* 同上 */ }
      thanks();
    });
    row.appendChild(b);
  });
  box.appendChild(q); box.appendChild(row); box.appendChild(note);
  if (done) thanks();
  prose.parentNode.insertBefore(box, prose.nextSibling); // ご意見箱(voice.js)より前に置く
})();
