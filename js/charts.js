/* emisiHAP - grafik kanvas. Dipakai di halaman dan disisipkan ke laporan Word. */
(function (root) {
  'use strict';
  var C = { s1: '#3F3F42', s2: '#A9A9AD', s3: '#F37022', ink: '#231F20', muted: '#6F6F72', line: '#E1E1DE',
    cats: { cat3: '#F37022', cat4: '#B9521A', cat6t: '#F7A46F', cat6h: '#FBD0B3', cat9: '#7A7A7E' } };
  var FONT = '"Segoe UI", Arial, Helvetica, sans-serif';

  function nice(max) {
    if (!(max > 0)) { return 1; }
    var p = Math.pow(10, Math.floor(Math.log10(max))), n = max / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function num(n, lang, d) {
    return new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'id-ID', { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 0 : d }).format(n);
  }
  function setup(canvas, w, h) {
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
    return ctx;
  }
  function legend(ctx, items, x, y, size) {
    ctx.font = size + 'px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    items.forEach(function (it) {
      ctx.fillStyle = it[1]; ctx.fillRect(x, y - size * 0.4, size * 0.8, size * 0.8);
      ctx.fillStyle = C.ink; ctx.fillText(it[0], x + size * 1.15, y);
      x += size * 1.15 + ctx.measureText(it[0]).width + size * 1.6;
    });
  }

  /* Tren bulanan: batang bertumpuk Scope 1, 2, 3. labels = teks bulan. */
  function trend(canvas, model, labels, lang, title) {
    var W = 1400, H = 620, ctx = setup(canvas, W, H), L = 110, Rr = 40, T = 110, B = 80;
    var ms = model.months, max = 0;
    ms.forEach(function (m) { max = Math.max(max, model.monthly[m.key].total); });
    var top = nice(max * 1.08), pw = W - L - Rr, ph = H - T - B;
    ctx.fillStyle = C.ink; ctx.font = '600 30px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(title, L, 46);
    legend(ctx, [['Scope 1', C.s1], ['Scope 2', C.s2], ['Scope 3', C.s3]], L, 80, 22);
    ctx.font = '20px ' + FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var i = 0; i <= 4; i++) {
      var v = top * i / 4, y = T + ph - ph * i / 4;
      ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, y + 0.5); ctx.lineTo(W - Rr, y + 0.5); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.fillText(num(v, lang, top < 10 ? 1 : 0), L - 12, y);
    }
    ctx.save(); ctx.translate(28, T + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = C.muted; ctx.fillText('tCO2e', 0, 0); ctx.restore();
    var slot = pw / ms.length, bw = Math.min(70, slot * 0.6);
    ms.forEach(function (m, idx) {
      var x = L + slot * idx + (slot - bw) / 2, y0 = T + ph, d = model.monthly[m.key];
      [['s1', C.s1], ['s2', C.s2], ['s3', C.s3]].forEach(function (s) {
        var hh = top > 0 ? ph * d[s[0]] / top : 0;
        if (hh > 0) { ctx.fillStyle = s[1]; ctx.fillRect(x, y0 - hh, bw, hh); y0 -= hh; }
      });
      ctx.fillStyle = C.ink; ctx.font = '19px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      if (d.total > 0) { ctx.fillText(num(d.total, lang, d.total < 100 ? 1 : 0), x + bw / 2, y0 - 6); }
      ctx.fillStyle = C.muted; ctx.textBaseline = 'top'; ctx.font = '20px ' + FONT; ctx.fillText(labels[idx], x + bw / 2, T + ph + 14);
    });
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L, T + ph + 0.5); ctx.lineTo(W - Rr, T + ph + 0.5); ctx.stroke();
  }

  /* Batang mendatar: items = [{label, value, color}] */
  function bars(canvas, items, lang, title, dec) {
    var W = 1400, rowH = 64, T = 90, B = 30, H = T + B + rowH * Math.max(items.length, 1), ctx = setup(canvas, W, H), L = 560, Rr = 170;
    var max = 0; items.forEach(function (it) { max = Math.max(max, it.value); });
    ctx.fillStyle = C.ink; ctx.font = '600 30px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(title, 30, 46);
    var total = 0; items.forEach(function (it) { total += it.value; });
    items.forEach(function (it, i) {
      var y = T + rowH * i, w = max > 0 ? (W - L - Rr) * it.value / max : 0;
      ctx.fillStyle = C.ink; ctx.font = '21px ' + FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      var label = it.label, mw = L - 50;
      while (ctx.measureText(label).width > mw && label.length > 8) { label = label.slice(0, -2); }
      if (label !== it.label) { label = label.replace(/\s+$/, '') + '...'; }
      ctx.fillText(label, L - 18, y + rowH / 2);
      ctx.fillStyle = '#F4F4F3'; ctx.fillRect(L, y + 14, W - L - Rr, rowH - 28);
      ctx.fillStyle = it.color; ctx.fillRect(L, y + 14, Math.max(w, it.value > 0 ? 2 : 0), rowH - 28);
      ctx.fillStyle = C.ink; ctx.textAlign = 'left';
      ctx.fillText(num(it.value, lang, dec == null ? 1 : dec) + (total > 0 ? '  (' + num(100 * it.value / total, lang, 0) + '%)' : ''), L + (W - L - Rr) + 12, y + rowH / 2);
    });
  }

  var api = { trend: trend, bars: bars, colors: C, num: num };
  root.HAPCharts = api;
})(typeof window !== 'undefined' ? window : globalThis);
