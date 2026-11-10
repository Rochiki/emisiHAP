/* emisiHAP - antarmuka. */
(function () {
  'use strict';
  var H = window.HAP, Ch = window.HAPCharts, Rp = window.HAPReport;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var n = function (v, d) { return new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v || 0); };
  var LS = { get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* penyimpanan tidak tersedia */ } } };

  function defaultFy() { var d = new Date(); return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1; }
  function cloneFactors(list) { return list.map(function (f) { var o = {}; Object.keys(f).forEach(function (k) { o[k] = f[k]; }); return o; }); }
  /* Gabungkan faktor tersimpan dengan daftar bawaan, agar kunci baru tetap muncul. */
  function loadFactors() {
    var saved = LS.get('hap_factors', null), base = cloneFactors(H.DEFAULT_FACTORS);
    if (!Array.isArray(saved)) { return base; }
    var by = {}; saved.forEach(function (f) { if (f && f.key) { by[f.key] = f; } });
    base.forEach(function (f) {
      var s = by[f.key]; if (!s) { return; }
      var v = typeof s.value === 'number' ? s.value : parseFloat(String(s.value).replace(',', '.'));
      if (isFinite(v) && v >= 0) { f.value = v; }
      f.status = s.status === 'Resmi' ? 'Resmi' : 'Ilustrasi'; f.source = String(s.source || '').slice(0, 200);
    });
    return base;
  }

  var state = { files: [], fyStart: LS.get('hap_fy', defaultFy()), from: 0, to: 11, rangeTouched: false, replaced: [], factors: loadFactors(), routes: LS.get('hap_routes', H.DEFAULT_ROUTES), model: null };
  if (!(state.fyStart >= 2020 && state.fyStart <= 2100)) { state.fyStart = defaultFy(); }

  function alertMsg(msg) { var a = $('alert'); if (!msg) { a.hidden = true; return; } a.textContent = msg; a.hidden = false; }
  window.addEventListener('error', function (e) { alertMsg('Terjadi kesalahan pada aplikasi: ' + (e.message || 'tidak diketahui') + '. Muat ulang halaman. Bila berulang, kirim pesan ini ke pengelola aplikasi.'); });
  window.addEventListener('unhandledrejection', function (e) { alertMsg('Terjadi kesalahan pada aplikasi: ' + ((e.reason && e.reason.message) || e.reason || 'tidak diketahui') + '.'); });

  /* ---------- Membaca file ---------- */
  function parseBuffer(name, buf) {
    var out = { name: name, buf: buf, kind: 'unknown', res: null, error: '' };
    if (!/\.(xlsx|xlsm)$/i.test(name)) { out.error = 'Bukan file Excel (.xlsx).'; return out; }
    var wb;
    try { wb = XLSX.read(new Uint8Array(buf), { type: 'array' }); } catch (e) { out.error = 'File rusak atau bukan Excel yang valid.'; return out; }
    try {
      if (wb.Sheets['Laporan']) { out.kind = 'vendor'; out.res = H.parseVendor(XLSX, wb, name); }
      else { out.kind = 's12'; out.res = H.parseScope12(XLSX, wb, name, state.fyStart); }
    } catch (e2) { out.error = 'File tidak bisa dibaca: ' + (e2.message || e2); }
    return out;
  }
  function addParsed(f) {
    /* Aturan ganti: database Scope 1-2 hanya satu; vendor + jenis + periode yang sama diganti file terbaru. */
    var same = function (x) {
      if (!(x.res && x.res.ok && f.res && f.res.ok) || x.kind !== f.kind || x.name === f.name) { return false; }
      return f.kind === 's12' || (x.res.type === f.res.type && x.res.period.key === f.res.period.key && H.norm(x.res.vendor) === H.norm(f.res.vendor));
    };
    state.files.filter(same).forEach(function (x) { state.replaced.push('"' + x.name + '" diganti oleh "' + f.name + '"'); });
    state.files = state.files.filter(function (x) { return !same(x); });
    state.files = state.files.filter(function (x) { return x.name !== f.name || (x.res && x.res.ok && !(f.res && f.res.ok)); });
    state.files.push(f);
  }
  function readFiles(list) {
    var arr = Array.prototype.slice.call(list || []);
    if (!arr.length) { return Promise.resolve(); }
    alertMsg('');
    return Promise.all(arr.map(function (file) {
      return new Promise(function (resolve) {
        if (file.size > 30 * 1024 * 1024) { resolve({ name: file.name, kind: 'unknown', res: null, error: 'Ukuran file lebih dari 30 MB.' }); return; }
        var rd = new FileReader();
        rd.onload = function () { resolve(parseBuffer(file.name, rd.result)); };
        rd.onerror = function () { resolve({ name: file.name, kind: 'unknown', res: null, error: 'File tidak bisa dibaca.' }); };
        rd.readAsArrayBuffer(file);
      });
    })).then(function (parsed) {
      state.replaced = [];
      parsed.forEach(addParsed); afterDataChange();
      if (state.replaced.length) { alertMsg('Satu vendor hanya dihitung sekali per periode, dan database Scope 1 dan 2 hanya satu. File terbaru dipakai: ' + state.replaced.join('; ') + '.'); }
    });
  }
  function afterDataChange() {
    if (!state.rangeTouched) { autoRange(); }
    recompute();
  }
  function vendors() { return state.files.filter(function (f) { return f.kind === 'vendor' && f.res && f.res.ok; }).map(function (f) { return f.res; }); }
  function s12() { var f = state.files.filter(function (x) { return x.kind === 's12' && x.res && x.res.ok; })[0]; return f ? f.res : null; }

  function autoRange() {
    var ms = H.fyMonths(state.fyStart), last = -1, s = s12();
    ms.forEach(function (m) {
      var has = vendors().some(function (v) { return v.period.key === m.key; });
      if (s && s.emTot && s.emTot[m.key] && (s.emTot[m.key].solar + s.emTot[m.key].bensin + s.emTot[m.key].listrik) > 0) { has = true; }
      if (has) { last = m.idx; }
    });
    state.from = 0; state.to = last < 0 ? 11 : last;
  }

  /* ---------- Hitung ulang ---------- */
  function recompute() {
    try {
      state.model = H.buildModel({ fyStart: state.fyStart, from: state.from, to: state.to, s12: s12(), vendors: vendors(), factors: state.factors, routes: state.routes });
    } catch (e) { state.model = null; alertMsg('Perhitungan gagal: ' + (e.message || e)); }
    renderFiles(); renderPeriod(); renderResult();
  }

  /* ---------- Tampilan ---------- */
  function mName(key) { return Rp.mLabel(key, 'id'); }
  function renderFiles() {
    if (!state.files.length) { $('fileList').innerHTML = '<p class="muted">Belum ada file.</p>'; return; }
    var h = '<table><thead><tr><th>File</th><th>Jenis</th><th>Isi</th><th>Status</th><th></th></tr></thead><tbody>';
    state.files.forEach(function (f, i) {
      var r = f.res, kind = '-', isi = '', pill = '<span class="pill bad">Ditolak</span>', notes = [];
      if (f.error) { notes.push([f.error, 1]); }
      if (r) {
        (r.errors || []).forEach(function (e) { notes.push([e, 1]); });
        (r.warnings || []).forEach(function (w) { notes.push([w, 0]); });
        if (f.kind === 'vendor') {
          kind = r.type ? 'Laporan ' + H.SPEC[r.type].name.toLowerCase() : 'Laporan vendor';
          if (r.ok) {
            isi = esc(r.vendor) + '<br><span class="small">' + mName(r.period.key) + ' · ' + r.rows.length + ' baris dihitung</span>';
            pill = r.excluded.length ? '<span class="pill warn">Sebagian</span>' : '<span class="pill">Terbaca</span>';
            r.excluded.slice(0, 5).forEach(function (x) { notes.push(['Baris ' + x.row + ': ' + x.reason, 1]); });
            if (r.excluded.length > 5) { notes.push(['dan ' + (r.excluded.length - 5) + ' baris lain.', 1]); }
            if (state.model && !state.model.months.some(function (m) { return m.key === r.period.key; })) { pill = '<span class="pill grey">Di luar rentang</span>'; }
          }
        } else if (f.kind === 's12') {
          kind = r.ok ? 'Database Scope 1 dan 2' : 'Tidak dikenali';
          if (r.ok) {
            var tot = 0; Object.keys(r.emTot).forEach(function (k) { tot += r.emTot[k].solar + r.emTot[k].bensin + r.emTot[k].listrik; });
            isi = r.locations.length + ' lokasi · sheet "' + esc(r.sheetUsed) + '"<br><span class="small">Total terbaca ' + n(tot, 2) + ' tCO2e. Cocokkan dengan dasbor Excel Anda.</span>';
            pill = '<span class="pill">Terbaca</span>';
          }
        }
      }
      h += '<tr><td>' + esc(f.name) + '</td><td>' + kind + '</td><td>' + isi + notes.map(function (x) { return '<div class="small' + (x[1] ? ' bad' : '') + '">' + esc(x[0]) + '</div>'; }).join('') + '</td><td>' + pill + '</td><td><button class="btn sm" data-del="' + i + '" type="button">Hapus</button></td></tr>';
    });
    $('fileList').innerHTML = h + '</tbody></table>';
  }
  function renderPeriod() {
    var ms = H.fyMonths(state.fyStart), opts = function (sel) { return ms.map(function (m) { return '<option value="' + m.idx + '"' + (m.idx === sel ? ' selected' : '') + '>' + mName(m.key) + '</option>'; }).join(''); };
    $('fy').value = state.fyStart; $('from').innerHTML = opts(state.from); $('to').innerHTML = opts(state.to);
    var out = vendors().filter(function (v) { return !ms.some(function (m) { return m.key === v.period.key; }); }).length;
    $('fyNote').textContent = 'Tahun fiskal ' + Rp.fyLabel({ fyStart: state.fyStart }) + '. Bulan pada database Scope 1 dan 2 dibaca sebagai tahun fiskal ini.' + (out ? ' ' + out + ' file vendor berada di luar tahun fiskal ini dan tidak dihitung.' : '');
  }
  function tile(label, value, sub, hi) { return '<div class="tile' + (hi ? ' hi' : '') + '"><span>' + label + '</span><b>' + value + '</b><small>' + (sub || '') + '</small></div>'; }

  function renderResult() {
    var m = state.model, box = $('result'), has = m && (m.hasS12 || m.hasVendor);
    $('btnDocx').disabled = !has; $('btnXlsx').disabled = !has;
    $('dlNote').textContent = has ? 'Laporan dibuat dari data dan rentang bulan yang sedang tampil.' : 'Unggah data dulu untuk mengaktifkan tombol unduh.';
    if (!has) { box.innerHTML = '<p class="muted">Belum ada data yang bisa dihitung. Unggah file pada langkah 1, atau klik "Coba dengan data contoh".</p>'; return; }
    var T = m.totals, q = m.quality, h = '';
    if (q.illustrative) { h += '<div class="banner bad"><strong>' + q.illustrative + ' faktor emisi masih berstatus Ilustrasi.</strong> Hasil di bawah adalah draf dan belum boleh dilaporkan. Ganti dengan faktor resmi di bagian "Faktor emisi dan jarak rute".</div>'; }
    h += '<div class="tiles" style="margin-top:14px">' +
      tile('Total emisi', n(T.total, 1), 'tCO2e, ' + Rp.rangeLabel(m, 'id'), 1) +
      tile('Scope 1', n(T.s1, 1), T.total > 0 ? n(100 * T.s1 / T.total, 0) + '% dari total' : '') +
      tile('Scope 2', n(T.s2, 1), T.total > 0 ? n(100 * T.s2 / T.total, 0) + '% dari total' : '') +
      tile('Scope 3 (terukur)', n(T.s3, 1), T.total > 0 ? n(100 * T.s3 / T.total, 0) + '% dari total' : '', 1) +
      tile('Scope 3 terhadap Scope 1+2', m.ratioS3 == null ? '-' : n(100 * m.ratioS3, 1) + '%', 'Kategori 3, 4, 6, 9') + '</div>';
    if (!m.hasS12) { h += '<div class="banner" style="margin-top:14px">Database Scope 1 dan 2 belum diunggah. Scope 1, Scope 2, dan Kategori 3 masih nol.</div>'; }
    h += '<div style="margin-top:16px"><canvas class="chart" id="vTrend"></canvas></div>';
    h += '<div class="grid2" style="margin-top:18px"><div><canvas class="chart" id="vCat"></canvas><div class="scroll"><table><thead><tr><th>Kategori Scope 3</th><th class="n">tCO2e</th><th class="n">%</th></tr></thead><tbody>' +
      H.CATS.map(function (c) { return '<tr><td>' + c.id + '</td><td class="n">' + n(T[c.key], 2) + '</td><td class="n">' + (T.s3 > 0 ? n(100 * T[c.key] / T.s3, 1) + '%' : '-') + '</td></tr>'; }).join('') +
      '<tr class="tot"><td>Total Scope 3</td><td class="n">' + n(T.s3, 2) + '</td><td class="n">' + (T.s3 > 0 ? '100,0%' : '-') + '</td></tr></tbody></table></div></div>';
    h += '<div>' + (m.hasS12 ? '<canvas class="chart" id="vSeg"></canvas><div class="scroll"><table><thead><tr><th>Segmen (Scope 1 dan 2)</th><th class="n">Scope 1</th><th class="n">Scope 2</th><th class="n">Total</th></tr></thead><tbody>' +
      H.SEGMENTS.map(function (s) { var v = m.segments[s.key]; return '<tr><td>' + s.id + '</td><td class="n">' + n(v.s1, 1) + '</td><td class="n">' + n(v.s2, 1) + '</td><td class="n">' + n(v.s1 + v.s2, 1) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td>Total</td><td class="n">' + n(T.s1, 1) + '</td><td class="n">' + n(T.s2, 1) + '</td><td class="n">' + n(T.s12, 1) + '</td></tr></tbody></table></div>' : '<p class="muted">Rincian segmen tampil setelah database Scope 1 dan 2 diunggah.</p>') + '</div></div>';
    h += '<h3 style="margin-top:18px">Rincian bulanan (tCO2e)</h3><div class="scroll"><table><thead><tr><th>Bulan</th><th class="n">Scope 1</th><th class="n">Scope 2</th><th class="n">Kat. 3</th><th class="n">Kat. 4</th><th class="n">Kat. 6</th><th class="n">Kat. 9</th><th class="n">Scope 3</th><th class="n">Total</th></tr></thead><tbody>' +
      m.months.map(function (mo) { var d = m.monthly[mo.key]; return '<tr><td>' + mName(mo.key) + '</td><td class="n">' + n(d.s1, 1) + '</td><td class="n">' + n(d.s2, 1) + '</td><td class="n">' + n(d.cat3, 2) + '</td><td class="n">' + n(d.cat4, 2) + '</td><td class="n">' + n(d.cat6t + d.cat6h, 2) + '</td><td class="n">' + n(d.cat9, 2) + '</td><td class="n">' + n(d.s3, 2) + '</td><td class="n">' + n(d.total, 1) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td>Total</td><td class="n">' + n(T.s1, 1) + '</td><td class="n">' + n(T.s2, 1) + '</td><td class="n">' + n(T.cat3, 2) + '</td><td class="n">' + n(T.cat4, 2) + '</td><td class="n">' + n(T.cat6t + T.cat6h, 2) + '</td><td class="n">' + n(T.cat9, 2) + '</td><td class="n">' + n(T.s3, 2) + '</td><td class="n">' + n(T.total, 1) + '</td></tr></tbody></table></div>';
    var notes = Rp.narrative(m).quality.map(function (x) { return x[0]; });
    h += '<h3 style="margin-top:18px">Catatan kualitas data</h3><ul class="notes">' + notes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    box.innerHTML = h;
    drawCharts('vTrend', 'vCat', 'vSeg');
  }

  function catItems(m) { return H.CATS.map(function (c) { return { label: c.id, value: m.totals[c.key], color: Ch.colors.cats[c.key] }; }); }
  function segItems(m) { return H.SEGMENTS.map(function (s) { return { label: s.id, value: m.segments[s.key].s1 + m.segments[s.key].s2, color: s.key === 'mining' ? Ch.colors.s3 : Ch.colors.s1 }; }).sort(function (a, b) { return b.value - a.value; }); }
  function drawCharts(a, b, c) {
    var m = state.model;
    Ch.trend($(a), m, m.months.map(function (x) { return H.SHORT_ID[x.m - 1] + " '" + String(x.y).slice(2); }), 'id', 'Emisi bulanan per scope (tCO2e)');
    Ch.bars($(b), catItems(m), 'id', 'Scope 3 per kategori (tCO2e)', 2);
    if (m.hasS12 && $(c)) { Ch.bars($(c), segItems(m), 'id', 'Scope 1 dan 2 per segmen (tCO2e)', 1); }
  }

  /* ---------- Faktor ---------- */
  function renderFactors() {
    var h = '<table><thead><tr><th>Kelompok</th><th>Faktor</th><th>Satuan</th><th>kgCO2e</th><th>Status</th><th>Sumber</th></tr></thead><tbody>';
    state.factors.forEach(function (f, i) {
      h += '<tr><td>' + esc(f.group) + '</td><td>' + esc(f.id) + (f.note ? '<div class="small">' + esc(f.note) + '</div>' : '') + '</td><td>' + esc(f.unit) + '</td><td><input class="num" type="text" inputmode="decimal" id="fv' + i + '" data-fi="' + i + '" data-k="value" value="' + esc(String(f.value).replace('.', ',')) + '" aria-label="Nilai faktor ' + esc(f.id) + '"></td>' +
        '<td><select id="fs' + i + '" data-fi="' + i + '" data-k="status" aria-label="Status faktor ' + esc(f.id) + '"><option' + (f.status !== 'Resmi' ? ' selected' : '') + '>Ilustrasi</option><option' + (f.status === 'Resmi' ? ' selected' : '') + '>Resmi</option></select></td>' +
        '<td><input type="text" id="fr' + i + '" data-fi="' + i + '" data-k="source" value="' + esc(f.source) + '" aria-label="Sumber faktor ' + esc(f.id) + '"></td></tr>';
    });
    $('factorTable').innerHTML = h + '</tbody></table>';
    $('routes').value = state.routes;
  }
  function saveFactors() { LS.set('hap_factors', state.factors); LS.set('hap_routes', state.routes); }

  /* ---------- Unduh ---------- */
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function fileStem() { var m = state.model, a = m.months[0], b = m.months[m.months.length - 1]; return 'FY' + m.fyStart + '_' + H.SHORT_EN[a.m - 1] + (a.key === b.key ? '' : '-' + H.SHORT_EN[b.m - 1]); }
  function makeDocx() {
    var m = state.model, btn = $('btnDocx');
    btn.disabled = true; btn.textContent = 'Menyusun laporan...';
    var done = function () { btn.disabled = false; btn.textContent = 'Laporan manajemen (Word, dwibahasa)'; };
    try {
      var cT = $('cTrend'), cC = $('cCat'), cS = $('cSeg');
      Ch.trend(cT, m, Rp.chartLabels(m), 'id', 'Emisi bulanan / Monthly emissions (tCO2e)');
      Ch.bars(cC, H.CATS.map(function (c) { return { label: 'Kat./Cat. ' + c.no + (c.key === 'cat6h' ? ' hotel' : c.key === 'cat6t' ? ' transport' : c.key === 'cat3' ? ' energi hulu / upstream energy' : c.key === 'cat4' ? ' transportasi hulu / upstream transport' : ' transportasi hilir / downstream transport'), value: m.totals[c.key], color: Ch.colors.cats[c.key] }; }), 'id', 'Scope 3 per kategori / by category (tCO2e)', 2);
      Ch.bars(cS, H.SEGMENTS.map(function (s) { return { label: s.id === s.en ? s.id : s.id + ' / ' + s.en, value: m.segments[s.key].s1 + m.segments[s.key].s2, color: Ch.colors.s1 }; }).sort(function (a, b) { return b.value - a.value; }), 'id', 'Scope 1 dan 2 per segmen / by segment (tCO2e)', 1);
      var d = new Date(), L = window.HAP_LOGO;
      var images = { logo: Rp.dataUrlBytes(L.url), logoRatio: L.h / L.w, trend: Rp.dataUrlBytes(cT.toDataURL('image/png')), cat: Rp.dataUrlBytes(cC.toDataURL('image/png')), catRatio: cC.height / cC.width, seg: Rp.dataUrlBytes(cS.toDataURL('image/png')), segRatio: cS.height / cS.width };
      var meta = { preparedBy: $('prep').value.trim() || 'QSHE Department', dateId: d.getDate() + ' ' + H.MONTHS_ID[d.getMonth()] + ' ' + d.getFullYear(), dateEn: d.getDate() + ' ' + H.MONTHS_EN[d.getMonth()] + ' ' + d.getFullYear() };
      var doc = Rp.buildDocx(m, images, meta);
      window.docx.Packer.toBlob(doc).then(function (blob) { download(blob, 'Laporan_Manajemen_Emisi_GRK_' + fileStem() + '.docx'); done(); })
        .catch(function (e) { done(); alertMsg('Laporan Word gagal dibuat: ' + (e.message || e)); });
    } catch (e) { done(); alertMsg('Laporan Word gagal dibuat: ' + (e.message || e)); }
  }
  function makeXlsx() {
    try {
      var wb = Rp.buildWorkbook(state.model, XLSX), out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Kertas_Kerja_Emisi_GRK_' + fileStem() + '.xlsx');
    } catch (e) { alertMsg('Kertas kerja Excel gagal dibuat: ' + (e.message || e)); }
  }

  /* ---------- Peristiwa ---------- */
  $('logo').src = window.HAP_LOGO.url;
  $('prep').value = LS.get('hap_prep', 'QSHE Department, PT Hexindo Adiperkasa Tbk');
  $('prep').addEventListener('change', function () { LS.set('hap_prep', $('prep').value); });
  $('file').addEventListener('change', function (e) { readFiles(e.target.files).then(function () { e.target.value = ''; }); });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) { readFiles(e.dataTransfer.files); } });
  $('fileList').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (b) { state.files.splice(+b.getAttribute('data-del'), 1); afterDataChange(); } });
  $('btnClear').addEventListener('click', function () { state.files = []; state.rangeTouched = false; alertMsg(''); afterDataChange(); });
  $('btnSample').addEventListener('click', function () {
    var names = ['samples/CONTOH_SINTETIS_Database_Scope12.xlsx', 'samples/Contoh_Ekspedisi_BENAR.xlsx', 'samples/Contoh_Travel_BENAR.xlsx'];
    Promise.all(names.map(function (p) { return fetch(p).then(function (r) { if (!r.ok) { throw new Error(p); } return r.arrayBuffer(); }).then(function (buf) { return parseBuffer(p.split('/').pop(), buf); }); }))
      .then(function (parsed) { state.fyStart = 2026; state.rangeTouched = false; state.files = []; parsed.forEach(function (f) { if (f.kind === 's12') { f = parseBuffer(f.name, f.buf); } addParsed(f); }); alertMsg(''); afterDataChange(); })
      .catch(function () { alertMsg('Data contoh hanya bisa dimuat bila aplikasi dibuka lewat alamat web (misalnya GitHub Pages), bukan dengan membuka file langsung. Anda tetap bisa mengunggah file sendiri.'); });
  });
  $('fy').addEventListener('change', function () {
    var v = parseInt($('fy').value, 10);
    if (!(v >= 2020 && v <= 2100)) { $('fy').value = state.fyStart; return; }
    state.fyStart = v; LS.set('hap_fy', v); state.rangeTouched = false;
    state.files = state.files.map(function (f) { return f.kind === 's12' && f.buf ? parseBuffer(f.name, f.buf) : f; });
    afterDataChange();
  });
  $('from').addEventListener('change', function () { state.from = +$('from').value; if (state.from > state.to) { state.to = state.from; } state.rangeTouched = true; recompute(); });
  $('to').addEventListener('change', function () { state.to = +$('to').value; if (state.to < state.from) { state.from = state.to; } state.rangeTouched = true; recompute(); });
  $('factorTable').addEventListener('change', function (e) {
    var t = e.target, i = t.getAttribute('data-fi'); if (i == null) { return; }
    var f = state.factors[+i], k = t.getAttribute('data-k');
    if (k === 'value') { var v = parseFloat(String(t.value).replace(/\s/g, '').replace(',', '.')); if (!isFinite(v) || v < 0) { t.value = String(f.value).replace('.', ','); alertMsg('Nilai faktor harus angka 0 atau lebih.'); return; } f.value = v; alertMsg(''); }
    else if (k === 'status') { f.status = t.value === 'Resmi' ? 'Resmi' : 'Ilustrasi'; }
    else { f.source = t.value.slice(0, 200); }
    saveFactors(); recompute();
  });
  $('routes').addEventListener('change', function () { state.routes = $('routes').value; saveFactors(); recompute(); });
  $('btnReset').addEventListener('click', function () { state.factors = cloneFactors(H.DEFAULT_FACTORS); state.routes = H.DEFAULT_ROUTES; saveFactors(); renderFactors(); recompute(); });
  $('btnExport').addEventListener('click', function () { download(new Blob([JSON.stringify({ factors: state.factors, routes: state.routes }, null, 2)], { type: 'application/json' }), 'faktor_emisi_emisiHAP.json'); });
  $('btnImport').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function (e) {
    var file = e.target.files[0]; if (!file) { return; }
    var rd = new FileReader();
    rd.onload = function () {
      try { var o = JSON.parse(rd.result); if (!o || !Array.isArray(o.factors)) { throw new Error('format'); } LS.set('hap_factors', o.factors); state.factors = loadFactors(); if (typeof o.routes === 'string') { state.routes = o.routes; } saveFactors(); renderFactors(); recompute(); alertMsg(''); }
      catch (err) { alertMsg('File faktor tidak valid. Gunakan file hasil "Ekspor faktor".'); }
      e.target.value = '';
    };
    rd.readAsText(file);
  });
  $('btnDocx').addEventListener('click', makeDocx);
  $('btnXlsx').addEventListener('click', makeXlsx);

  renderFactors();
  recompute();
  window.HAPApp = { state: state, readFiles: readFiles };
})();
