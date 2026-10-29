// 一覧・トップの記事のサムネイルを、見られているときだけ動かす(タイトル動画のプレビュー)。
// 動画は、動かすときに初めて読み込む(最初は静止画だけ)。同時に動くのは1本だけ。
//  ・PC(カーソルがある端末): カーソルを載せたカードだけ、再生。外れたら止める
//  ・スマホなど: 画面の中央に最も近い1本だけ、再生。スクロールで外れたら止める
//  ・動きを減らす設定、通信量を節約する設定(データセーバー)の端末では、何もしない(静止画のまま)
(function () {
  var nodes = [].slice.call(document.querySelectorAll('[data-preview][data-video-src]'));
  if (!nodes.length) return;
  var mm = function (q) { return window.matchMedia && window.matchMedia(q).matches; };
  var conn = navigator.connection || {};
  if (mm('(prefers-reduced-motion: reduce)') || conn.saveData) return;
  var active = null;
  function stop(node) {
    if (!node) return;
    var v = node.querySelector('video');
    if (v) { try { v.pause(); } catch (e) { /* 止められなくても消す */ } v.remove(); }
    if (active === node) active = null;
  }
  function play(node) {
    if (active === node || node._failed) return;      // 読み込めなかったカードは、もう試さない
    stop(active);
    active = node;
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    v.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .4s;background:#0B0B0B');
    v.addEventListener('playing', function () { v.style.opacity = '1'; });
    v.addEventListener('error', function () { node._failed = true; v.remove(); if (active === node) active = null; });
    v.src = node.getAttribute('data-video-src');
    node.appendChild(v);
    var p = v.play(); if (p && p.catch) p.catch(function () { node._failed = true; v.remove(); if (active === node) active = null; });
  }
  if (mm('(hover: hover)')) {
    nodes.forEach(function (node) {
      var card = node.closest('a') || node;
      card.addEventListener('mouseenter', function () { play(node); });
      card.addEventListener('mouseleave', function () { stop(node); });
      card.addEventListener('focusin', function () { play(node); });   // キーボードでも
      card.addEventListener('focusout', function () { stop(node); });
    });
    return;
  }
  // スマホ: 画面の中央に最も近い1本(半分以上見えているもの)。止まって300ms たってから動かす(速いスクロールで、読み込まない)
  var ratio = new Map(), timer = null;
  function pick() {
    var best = null, bestD = 1e9, mid = window.innerHeight / 2;
    ratio.forEach(function (r, node) {
      if (r < 0.55) return;
      var b = node.getBoundingClientRect(), d = Math.abs((b.top + b.bottom) / 2 - mid);
      if (d < bestD) { bestD = d; best = node; }
    });
    if (best) play(best); else { stop(active); }
  }
  function later() { clearTimeout(timer); timer = setTimeout(pick, 300); }
  if (!('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { ratio.set(e.target, e.intersectionRatio); });
    later();
  }, { threshold: [0, 0.25, 0.55, 0.8, 1] });
  nodes.forEach(function (n) { io.observe(n); });
  window.addEventListener('scroll', later, { passive: true });
})();
