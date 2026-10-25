// ご意見箱。[data-voice] の場所に、フォームを描く。送った内容は D1 に貯まり、管理者用の集計ページ(/ops/pulse/)で読む。
// 名前・連絡先は聞かない(匿名。返信はしない)。Cookie も使わない。
(function () {
  var CATS = {
    learn: 'もっと知りたい・深掘りしてほしい',
    beer: 'クラフトビールの「これって何?」',
    site: 'ホームページの感想',
    yagiriya: 'YAGIRIYAへのご意見・ご要望'
  };
  var HINT = {
    learn: 'どのページの、どこを、もっと詳しく知りたいですか?',
    beer: '気になる言葉や、ビールのことを書いてください。読みものやBEER 101で取り上げます。',
    site: '見やすさ、分かりにくかったところ、よかったところなど。',
    yagiriya: 'メニュー、お店の雰囲気、サービスなど。'
  };
  var TH = {
    brewery: { bg: 'transparent', line: '#3A3A3A', accent: '#C9AA6E', text: '#E6E0D2', mute: '#BDB7A9', btnBg: '#C9AA6E', btnText: '#0B0B0B', field: '#141414', font: "'Zen Kaku Gothic New',sans-serif", head: "Cinzel,'Times New Roman',serif", title: 'ご意見箱', lead: 'もっと知りたいこと、ホームページの感想、ビールの「これって何?」。今後の読みものやBEER 101の参考にします。' },
    yagiriya: { bg: '#FBF6EA', line: '#145E50', accent: '#145E50', text: '#145E50', mute: '#145E50', btnBg: '#145E50', btnText: '#F4ECD9', field: '#FFFFFF', font: "'Zen Maru Gothic',sans-serif", head: "'Alfa Slab One',serif", title: 'ご意見・ご要望', lead: 'YAGIRIYAへのご意見やご要望を、お気軽にどうぞ。お店づくりの参考にします。' }
  };
  var hosts = document.querySelectorAll('[data-voice]');
  if (!hosts.length) return;
  function el(tag, style, text) { var e = document.createElement(tag); if (style) e.setAttribute('style', style); if (text != null) e.textContent = text; return e; }
  hosts.forEach(function (host, n) {
    var t = TH[host.getAttribute('data-theme')] || TH.brewery;
    var cats = (host.getAttribute('data-cats') || 'learn,beer,site').split(',').filter(function (c) { return CATS[c]; });
    var cat = cats.indexOf(host.getAttribute('data-default')) >= 0 ? host.getAttribute('data-default') : cats[0];
    var shownAt = Date.now();
    var box = el('div', 'margin-top:56px;border:' + (t.bg === 'transparent' ? '1px' : '3px double') + ' solid ' + t.line + ';background:' + t.bg + ';padding:28px;font-family:' + t.font + ';color:' + t.text + ';font-size:17px;line-height:1.9');
    box.appendChild(el('div', 'font-family:' + t.head + ';font-size:15px;letter-spacing:.2em;color:' + t.accent, 'VOICE'));
    box.appendChild(el('h2', 'margin:4px 0 8px;font-family:' + t.head + ';font-weight:400;font-size:26px;line-height:1.4', t.title));
    box.appendChild(el('p', 'margin:0 0 16px;font-size:16px;color:' + t.mute, t.lead));
    var form = el('form', 'display:flex;flex-direction:column;gap:14px'); form.noValidate = true;
    var fs = el('fieldset', 'border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px'); fs.appendChild(el('legend', 'position:absolute;left:-9999px', 'ご意見の種類'));
    var hint = el('p', 'margin:0;font-size:15px;color:' + t.mute, HINT[cat]);
    cats.forEach(function (c) {
      var lab = el('label', 'display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:2px solid ' + t.accent + ';cursor:pointer;font-size:15px');
      var r = el('input', 'margin-right:8px;accent-color:' + t.accent); r.type = 'radio'; r.name = 'cat' + n; r.value = c; r.checked = c === cat;
      r.addEventListener('change', function () { cat = c; hint.textContent = HINT[c]; });
      lab.appendChild(r); lab.appendChild(document.createTextNode(CATS[c])); fs.appendChild(lab);
    });
    var ta = el('textarea', 'width:100%;min-height:140px;padding:12px;border:2px solid ' + t.accent + ';background:' + t.field + ';color:' + (t.bg === 'transparent' ? t.text : '#145E50') + ';font:inherit;font-size:17px;box-sizing:border-box;resize:vertical');
    ta.maxLength = 500; ta.setAttribute('aria-label', 'ご意見の内容(500字まで)');
    var count = el('span', 'font-size:14px;color:' + t.mute, '0 / 500');
    ta.addEventListener('input', function () { count.textContent = ta.value.length + ' / 500'; });
    var trap = el('input', 'position:absolute;left:-9999px;width:1px;height:1px'); trap.type = 'text'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.setAttribute('aria-hidden', 'true'); // 人は見ない欄(自動入力のスパム除け)
    var btn = el('button', 'min-height:48px;padding:0 28px;background:' + t.btnBg + ';color:' + t.btnText + ';border:0;font:inherit;font-size:17px;font-weight:700;cursor:pointer;align-self:flex-start', '送る');
    btn.type = 'submit';
    var msg = el('p', 'margin:0;font-size:16px', ''); msg.setAttribute('role', 'status');
    var note = el('p', 'margin:0;font-size:14px;color:' + t.mute, '個人を特定できる情報(お名前・連絡先など)は書かないでください。匿名で受け付けるため、返信はできません。');
    [fs, hint, ta, count, trap, btn, msg, note].forEach(function (x) { form.appendChild(x); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = ta.value.trim();
      if (text.length < 5) { msg.textContent = 'もう少し詳しく書いてください(5文字以上)。'; return; }
      btn.disabled = true; msg.textContent = '送っています…';
      fetch('/api/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: location.pathname, cat: cat, msg: text, hp: trap.value, ms: Date.now() - shownAt }) })
        .then(function (r) {
          if (r.status === 429) throw new Error('本日の受付は上限です。明日あらためてお送りください。');
          if (!r.ok) throw new Error('送れませんでした。時間をおいて、もう一度お試しください。');
          form.textContent = ''; form.appendChild(el('p', 'margin:0;font-size:18px;font-weight:700', 'ありがとうございました。いただいたご意見は、今後の読みものやお店づくりの参考にします。'));
        })
        .catch(function (er) { btn.disabled = false; msg.textContent = er.message || '送れませんでした。時間をおいて、もう一度お試しください。'; });
    });
    box.appendChild(form); host.appendChild(box);
  });
})();
