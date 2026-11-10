/* emisiHAP - mesin hitung. Murni logika, tanpa DOM. Dipakai di browser (window.HAP) dan di uji Node. */
(function (root) {
  'use strict';

  var MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* Faktor emisi bawaan (kgCO2e per satuan). SEMUA berstatus Ilustrasi sampai diganti faktor resmi. */
  var DEFAULT_FACTORS = [
    { key: 'S1|Solar', group: 'Scope 1', id: 'Solar (pembakaran)', en: 'Diesel (combustion)', unit: 'liter', value: 2.62, note: 'Hanya untuk memperkirakan liter bila data aktivitas tidak terbaca' },
    { key: 'S1|Bensin', group: 'Scope 1', id: 'Bensin (pembakaran)', en: 'Gasoline (combustion)', unit: 'liter', value: 2.29, note: 'Hanya untuk memperkirakan liter bila data aktivitas tidak terbaca' },
    { key: 'S2|Listrik', group: 'Scope 2', id: 'Listrik (rata-rata jaringan)', en: 'Electricity (grid average)', unit: 'kWh', value: 0.85, note: 'Hanya untuk memperkirakan kWh bila data aktivitas tidak terbaca' },
    { key: 'WTT|Solar', group: 'Cat 3', id: 'Solar, hulu (well-to-tank)', en: 'Diesel, upstream (well-to-tank)', unit: 'liter', value: 0.61, note: '' },
    { key: 'WTT|Bensin', group: 'Cat 3', id: 'Bensin, hulu (well-to-tank)', en: 'Gasoline, upstream (well-to-tank)', unit: 'liter', value: 0.60, note: '' },
    { key: 'WTT|Listrik', group: 'Cat 3', id: 'Listrik, hulu dan susut jaringan', en: 'Electricity, upstream and T&D losses', unit: 'kWh', value: 0.10, note: '' },
    { key: 'BBM|Solar', group: 'Cat 4/9', id: 'BBM armada vendor, solar', en: 'Vendor fleet fuel, diesel', unit: 'liter', value: 2.62, note: '' },
    { key: 'BBM|Bensin', group: 'Cat 4/9', id: 'BBM armada vendor, bensin', en: 'Vendor fleet fuel, gasoline', unit: 'liter', value: 2.29, note: '' },
    { key: 'TKM|Pickup / blind van', group: 'Cat 4/9', id: 'Pickup / blind van', en: 'Pickup / van', unit: 'ton-km', value: 0.60, note: '' },
    { key: 'TKM|Truk engkel', group: 'Cat 4/9', id: 'Truk engkel', en: 'Light truck', unit: 'ton-km', value: 0.35, note: '' },
    { key: 'TKM|Truk CDD', group: 'Cat 4/9', id: 'Truk CDD', en: 'Medium truck (CDD)', unit: 'ton-km', value: 0.30, note: '' },
    { key: 'TKM|Truk fuso', group: 'Cat 4/9', id: 'Truk fuso', en: 'Heavy truck (fuso)', unit: 'ton-km', value: 0.20, note: '' },
    { key: 'TKM|Tronton', group: 'Cat 4/9', id: 'Tronton', en: 'Rigid 3-axle truck', unit: 'ton-km', value: 0.12, note: '' },
    { key: 'TKM|Trailer / low bed', group: 'Cat 4/9', id: 'Trailer / low bed', en: 'Trailer / low bed', unit: 'ton-km', value: 0.09, note: '' },
    { key: 'TKM|Lainnya', group: 'Cat 4/9', id: 'Armada lain (default)', en: 'Other vehicle (default)', unit: 'ton-km', value: 0.15, note: '' },
    { key: 'PAX|Pesawat|Ekonomi', group: 'Cat 6', id: 'Pesawat, ekonomi', en: 'Flight, economy', unit: 'penumpang-km', value: 0.15, note: '' },
    { key: 'PAX|Pesawat|Bisnis', group: 'Cat 6', id: 'Pesawat, bisnis', en: 'Flight, business', unit: 'penumpang-km', value: 0.22, note: '' },
    { key: 'PAX|Pesawat|Lainnya', group: 'Cat 6', id: 'Pesawat, kelas lain (default)', en: 'Flight, other class (default)', unit: 'penumpang-km', value: 0.15, note: '' },
    { key: 'PAX|Kereta', group: 'Cat 6', id: 'Kereta', en: 'Rail', unit: 'penumpang-km', value: 0.04, note: '' },
    { key: 'PAX|Mobil sewa/taksi', group: 'Cat 6', id: 'Mobil sewa / taksi', en: 'Rental car / taxi', unit: 'km kendaraan', value: 0.17, note: '' },
    { key: 'PAX|Lainnya', group: 'Cat 6', id: 'Moda lain (default)', en: 'Other mode (default)', unit: 'penumpang-km', value: 0.15, note: '' },
    { key: 'HOTEL|malam', group: 'Cat 6', id: 'Hotel', en: 'Hotel stay', unit: 'kamar-malam', value: 20, note: '' }
  ];
  DEFAULT_FACTORS.forEach(function (f) { f.status = 'Ilustrasi'; f.source = ''; });

  var DEFAULT_ROUTES = 'CGK-BPN=1260\nCGK-BDJ=950\nCGK-SUB=695\nCGK-PLM=420\nCGK-UPG=1435\nCGK-PNK=730\nBPN-BDJ=340\nBPN-SUB=820\nBPN-UPG=515';

  var SPEC = {
    eks: { name: 'Ekspedisi', heads: ['No', 'Tanggal kirim', 'No. surat jalan / DO', 'No. invoice', 'Asal (kota)', 'Tujuan (kota)', 'Jarak tempuh (km)', 'Berat muatan (kg)', 'Berat (ton) otomatis', 'Ton-km otomatis', 'Jenis armada', 'No. polisi (opsional)', 'BBM terpakai (liter, opsional)', 'Jenis BBM', 'Pembayar ongkos', 'Catatan', 'Cek'] },
    trv: { name: 'Travel agent', heads: ['No', 'Tanggal perjalanan / check-in', 'Nama pelaku / NIK', 'Departemen / lokasi kerja', 'Jenis layanan', 'Asal (kota/bandara)', 'Tujuan (kota/bandara)', 'SJ / PP', 'Jarak (km, total, bila ada)', 'Kelas penerbangan', 'Jumlah malam (hotel)', 'Kota hotel', 'Nilai tagihan (Rp)', 'No. tiket / invoice', 'Catatan', 'Cek'] }
  };

  var CATS = [
    { key: 'cat3', no: 3, id: 'Kat. 3: Energi hulu (dari data Scope 1 dan 2)', en: 'Cat. 3: Fuel- and energy-related activities' },
    { key: 'cat4', no: 4, id: 'Kat. 4: Transportasi hulu (dibayar Hexindo)', en: 'Cat. 4: Upstream transportation (paid by Hexindo)' },
    { key: 'cat6t', no: 6, id: 'Kat. 6: Perjalanan dinas, transportasi', en: 'Cat. 6: Business travel, transport' },
    { key: 'cat6h', no: 6, id: 'Kat. 6: Perjalanan dinas, hotel', en: 'Cat. 6: Business travel, hotel' },
    { key: 'cat9', no: 9, id: 'Kat. 9: Transportasi hilir (dibayar pihak lain)', en: 'Cat. 9: Downstream transportation (paid by others)' }
  ];

  /* ---------- util ---------- */
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function blank(x) { return String(x == null ? '' : x).trim() === ''; }
  function ym(y, m) { return y + '-' + (m < 10 ? '0' : '') + m; }
  function code3(x) { var s = String(x).trim(), m = s.match(/\(([A-Za-z]{3})\)/); return (m ? m[1] : s).toUpperCase(); }
  function round(n, d) { var p = Math.pow(10, d == null ? 6 : d); return Math.round((n + Number.EPSILON) * p) / p; }

  function parseRoutes(text) {
    var out = {};
    String(text || '').split(/\r\n|\r|\n/).forEach(function (line) {
      var m = line.match(/^\s*([A-Za-z]{3})\s*-\s*([A-Za-z]{3})\s*=\s*([\d.,]+)\s*$/);
      if (!m) { return; }
      var a = m[1].toUpperCase(), b = m[2].toUpperCase(), v = parseFloat(m[3].replace(',', '.'));
      if (isFinite(v) && v > 0) { out[a < b ? a + '-' + b : b + '-' + a] = v; }
    });
    return out;
  }
  function factorMap(list) {
    var m = {};
    (list || []).forEach(function (f) { var v = typeof f.value === 'number' ? f.value : parseFloat(String(f.value).replace(',', '.')); if (isFinite(v) && v >= 0) { m[f.key] = v; } });
    return m;
  }
  function monthFromText(t) {
    var s = norm(t);
    if (!s) { return 0; }
    var pats = [[1, /\bjan/], [2, /\bfeb|\bpeb/], [3, /\bmar/], [4, /\bapr/], [5, /\bmay\b|\bmei\b/], [6, /\bjun/], [7, /\bjul/], [8, /\baug|\bagu|\bags/], [9, /\bsep/], [10, /\boct|\bokt/], [11, /\bnov|\bnop/], [12, /\bdec|\bdes/]];
    for (var i = 0; i < pats.length; i++) { if (pats[i][1].test(s)) { return pats[i][0]; } }
    return 0;
  }
  function fyMonths(fyStart) {
    var out = [];
    for (var i = 0; i < 12; i++) { var m = ((3 + i) % 12) + 1, y = m >= 4 ? fyStart : fyStart + 1; out.push({ key: ym(y, m), y: y, m: m, idx: i }); }
    return out;
  }
  function sheetAoa(X, ws) {
    /* Sel error Excel (#REF!, #DIV/0!) dibaca pustaka sebagai kode angka. Ubah ke teks agar tidak ikut terjumlah. */
    Object.keys(ws).forEach(function (k) { var c = ws[k]; if (k[0] !== '!' && c && c.t === 'e') { c.t = 's'; c.v = c.w || '#ERROR'; } });
    return X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
  }

  /* ---------- 1. File vendor (template ekspedisi / travel agent) ---------- */
  function detectVendorType(g) {
    var types = ['eks', 'trv'];
    for (var t = 0; t < types.length; t++) {
      var heads = SPEC[types[t]].heads, ok = true;
      for (var i = 0; i < heads.length; i++) { if (norm(g(8, i)) !== norm(heads[i])) { ok = false; break; } }
      if (ok) { return types[t]; }
    }
    return null;
  }

  function parseVendor(X, wb, fileName) {
    var res = { kind: 'vendor', file: fileName, ok: false, type: null, vendor: '', period: null, pic: '', rows: [], excluded: [], errors: [], warnings: [] };
    var ws = wb.Sheets['Laporan'];
    if (!ws) { res.errors.push('Sheet "Laporan" tidak ditemukan.'); return res; }
    var a = sheetAoa(X, ws);
    var g = function (r, c) { var x = (a[r] || [])[c]; return x == null ? '' : x; };
    var type = detectVendorType(g);
    if (!type) { res.errors.push('Kolom tidak sama dengan template Ekspedisi maupun Travel agent. Jangan mengubah nama atau urutan kolom.'); return res; }
    res.type = type;
    res.vendor = String(g(2, 2)).trim();
    res.pic = String(g(5, 2)).trim();
    var mIdx = MONTHS_ID.map(norm).indexOf(norm(g(3, 2))) + 1, yr = +g(4, 2);
    if (!res.vendor) { res.errors.push('Nama vendor (sel C3) kosong.'); }
    if (!mIdx || !(yr >= 2020 && yr <= 2100)) { res.errors.push('Bulan (C4) atau tahun (C5) tidak valid: "' + g(3, 2) + ' ' + g(4, 2) + '".'); }
    if (res.errors.length) { return res; }
    res.period = { y: yr, m: mIdx, key: ym(yr, mIdx) };

    var keys = type === 'eks' ? [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    var BAYAR = ['Hexindo', 'Customer', 'HCM', 'Lainnya'], LAY = ['Pesawat', 'Kereta', 'Mobil sewa/taksi', 'Hotel', 'Lainnya'];
    var outside = 0;
    for (var r = 10; r < Math.min(a.length, 510); r++) {
      var filled = false;
      for (var k = 0; k < keys.length; k++) { if (!blank(g(r, keys[k]))) { filled = true; break; } }
      if (!filled) { continue; }
      var p = [], miss = [], row = { row: r + 1 };
      var need = function (c, name) { if (blank(g(r, c))) { miss.push(name); } };
      var date = g(r, 1);
      if (!blank(date)) {
        if (!isNum(date) || date < 43831) { p.push('tanggal bukan format tanggal'); }
        else { var d = X.SSF.parse_date_code(date); row.date = ym(d.y, d.m) + '-' + (d.d < 10 ? '0' : '') + d.d; if (d.y !== yr || d.m !== mIdx) { outside++; } }
      }
      if (type === 'eks') {
        need(1, 'tanggal kirim'); need(2, 'no. surat jalan'); need(4, 'asal'); need(5, 'tujuan'); need(6, 'jarak'); need(7, 'berat'); need(14, 'pembayar ongkos');
        var G = g(r, 6), H = g(r, 7), by = String(g(r, 14)).trim();
        if (!blank(G) && (!isNum(G) || G <= 0)) { p.push('jarak harus angka lebih dari 0 (terisi "' + G + '")'); }
        if (!blank(H) && (!isNum(H) || H <= 0)) { p.push('berat harus angka lebih dari 0 (terisi "' + H + '")'); }
        if (by && BAYAR.indexOf(by) < 0) { p.push('pembayar ongkos di luar pilihan (terisi "' + by + '")'); }
        var bbm = g(r, 12), jb = String(g(r, 13)).trim();
        if (!blank(bbm) && (!isNum(bbm) || bbm < 0)) { p.push('BBM harus angka'); }
        if (isNum(bbm) && bbm > 0 && (jb === '' || jb === '-')) { p.push('jenis BBM belum diisi'); }
        row.kind = 'eks'; row.ref = String(g(r, 2)); row.desc = String(g(r, 4)) + ' - ' + String(g(r, 5));
        row.km = G; row.kg = H; row.tkm = isNum(G) && isNum(H) ? G * H / 1000 : 0; row.armada = String(g(r, 10)).trim(); row.bbm = isNum(bbm) ? bbm : 0; row.jenisBBM = jb; row.payer = by;
      } else {
        need(1, 'tanggal'); need(2, 'nama / NIK'); need(4, 'jenis layanan');
        var ly = String(g(r, 4)).trim();
        if (ly && LAY.indexOf(ly) < 0) { p.push('jenis layanan di luar pilihan (terisi "' + ly + '")'); }
        row.layanan = ly; row.ref = String(g(r, 13));
        if (ly === 'Hotel') {
          need(10, 'jumlah malam'); need(11, 'kota hotel');
          var mm = g(r, 10); if (!blank(mm) && (!isNum(mm) || mm <= 0)) { p.push('jumlah malam harus angka lebih dari 0'); }
          row.kind = 'hotel'; row.malam = isNum(mm) ? mm : 0; row.desc = 'Hotel ' + String(g(r, 11));
        } else {
          need(5, 'asal'); need(6, 'tujuan');
          var sj = String(g(r, 7)).trim();
          if (sj === '') { miss.push('SJ / PP'); } else if (sj !== 'SJ' && sj !== 'PP') { p.push('SJ / PP harus SJ atau PP'); }
          var dist = g(r, 8);
          if (!blank(dist) && (!isNum(dist) || dist < 0)) { p.push('jarak harus angka'); }
          var k1 = code3(g(r, 5)), k2 = code3(g(r, 6));
          row.kind = 'trip'; row.kelas = String(g(r, 9)).trim(); row.mult = sj === 'PP' ? 2 : 1; row.dist = isNum(dist) && dist > 0 ? dist : null;
          row.routeKey = k1 < k2 ? k1 + '-' + k2 : k2 + '-' + k1; row.desc = ly + ' ' + String(g(r, 5)) + ' - ' + String(g(r, 6)) + (sj === 'PP' ? ' (PP)' : '');
        }
      }
      if (miss.length) { p.unshift('isi ' + miss.join(', ')); }
      if (p.length) { res.excluded.push({ row: r + 1, reason: p.join('; ') }); } else { res.rows.push(row); }
    }
    if (!res.rows.length && !res.excluded.length) { res.errors.push('Belum ada baris data (mulai baris 11).'); return res; }
    if (outside) { res.warnings.push(outside + ' baris bertanggal di luar ' + MONTHS_ID[mIdx - 1] + ' ' + yr + '. Emisi tetap dicatat pada periode file.'); }
    if (res.excluded.length) { res.warnings.push(res.excluded.length + ' baris tidak dihitung karena datanya belum benar.'); }
    res.ok = res.rows.length > 0;
    if (!res.ok) { res.errors.push('Semua baris bermasalah, tidak ada yang bisa dihitung.'); }
    return res;
  }

  /* Hitung satu baris vendor. F = factorMap, R = parseRoutes. */
  function calcVendorRow(row, F, R) {
    var out = { cat: '', method: '', qty: 0, unit: '', fkey: '', factor: null, kg: null, note: '' };
    var pick = function (a, b) { if (F[a] != null) { out.fkey = a; return F[a]; } if (b && F[b] != null) { out.fkey = b; out.note = 'Memakai faktor default'; return F[b]; } return null; };
    if (row.kind === 'eks') {
      out.cat = row.payer === 'Hexindo' ? 'cat4' : 'cat9';
      if (row.payer === 'HCM' || row.payer === 'Lainnya') { out.note = 'Tinjau kategori pembayar'; out.review = true; }
      if (row.bbm > 0 && F['BBM|' + row.jenisBBM] != null) { out.method = 'BBM aktual'; out.qty = row.bbm; out.unit = 'liter'; out.fkey = 'BBM|' + row.jenisBBM; out.factor = F[out.fkey]; }
      else { out.method = 'Ton-km'; out.qty = row.tkm; out.unit = 'ton-km'; var n0 = out.note; out.factor = pick('TKM|' + row.armada, 'TKM|Lainnya'); if (n0 && out.note !== n0) { out.note = n0 + '; ' + out.note; } }
    } else if (row.kind === 'hotel') {
      out.cat = 'cat6h'; out.method = 'Kamar-malam'; out.qty = row.malam; out.unit = 'kamar-malam'; out.factor = pick('HOTEL|malam');
    } else {
      out.cat = 'cat6t'; out.method = 'Jarak'; out.unit = 'km';
      var dist = row.dist != null ? row.dist : (R[row.routeKey] || null);
      if (dist == null) { out.note = 'Jarak rute ' + row.routeKey + ' belum ada'; out.missing = true; return out; }
      if (row.dist == null) { out.note = 'Jarak dari tabel rute'; }
      out.qty = dist * row.mult;
      var n1 = out.note;
      out.factor = row.layanan === 'Pesawat' ? pick('PAX|Pesawat|' + row.kelas, 'PAX|Pesawat|Lainnya') : pick('PAX|' + row.layanan, 'PAX|Lainnya');
      if (n1 && out.note !== n1) { out.note = n1 + '; ' + out.note; }
    }
    if (out.factor == null) { out.note = (out.note ? out.note + '; ' : '') + 'Faktor emisi tidak tersedia'; out.missing = true; return out; }
    out.kg = out.qty * out.factor;
    return out;
  }

  /* ---------- 2. Database Scope 1 dan 2 ---------- */
  function energyOf(t) {
    var s = norm(t);
    if (/solar|diesel/.test(s)) { return 'solar'; }
    if (/bensin|gasoline|pertalite|pertamax/.test(s)) { return 'bensin'; }
    if (/listrik|electric|kwh/.test(s)) { return 'listrik'; }
    if (/\bair\b|water/.test(s)) { return 'air'; }
    return null;
  }

  /* Baca sheet berbentuk matriks: baris lokasi x (bulan x energi). */
  function parseMatrix(a) {
    var hr = -1, locCol = -1, catCol = -1;
    for (var r = 0; r < Math.min(a.length, 40) && hr < 0; r++) {
      for (var c = 0; c < (a[r] || []).length; c++) {
        if (/^lokasi( area)?$|^location$/.test(norm(a[r][c]))) { hr = r; locCol = c; break; }
      }
    }
    if (hr < 0) { return null; }
    for (var c2 = 0; c2 < (a[hr] || []).length; c2++) { if (/^kategori$|^category$/.test(norm(a[hr][c2]))) { catCol = c2; } }
    var cols = [], cur = 0, width = Math.max((a[hr] || []).length, (a[hr + 1] || []).length);
    var subUnits = '';
    for (var c3 = locCol + 1; c3 < width; c3++) {
      var top = (a[hr] || [])[c3];
      if (!blank(top)) { cur = monthFromText(top); }
      var en = energyOf((a[hr + 1] || [])[c3]);
      if (cur && en) { cols.push({ c: c3, m: cur, e: en }); subUnits += ' ' + norm((a[hr + 1] || [])[c3]); }
    }
    if (!cols.length) { return null; }
    var rows = [], seen = {}, gap = 0, cat = '', bad = 0;
    for (var r2 = hr + 2; r2 < a.length; r2++) {
      var loc = String((a[r2] || [])[locCol] == null ? '' : a[r2][locCol]).trim();
      if (catCol >= 0 && !blank((a[r2] || [])[catCol])) { cat = String(a[r2][catCol]).trim(); }
      if (!loc) { gap++; if (rows.length && gap >= 2) { break; } continue; }
      gap = 0;
      if (/^(grand )?total|^jumlah|^lokasi/.test(norm(loc))) { if (rows.length) { break; } continue; }
      if (seen[norm(loc)]) { continue; }
      seen[norm(loc)] = 1;
      var vals = {};
      cols.forEach(function (col) {
        var v = a[r2][col.c];
        if (!isNum(v)) { if (!blank(v)) { bad++; } v = 0; }
        if (v < 0) { bad++; v = 0; }
        vals[col.m] = vals[col.m] || { solar: 0, bensin: 0, listrik: 0, air: 0 };
        vals[col.m][col.e] += v;
      });
      rows.push({ name: loc, cat: cat, vals: vals });
    }
    if (!rows.length) { return null; }
    return { rows: rows, headText: norm((a[hr] || []).join(' ')), subText: subUnits, badCells: bad, hasCat: catCol >= 0, months: cols.map(function (x) { return x.m; }).filter(function (v, i, s) { return s.indexOf(v) === i; }) };
  }

  function segmentOf(name, cat) {
    var n = norm(name), c = norm(cat);
    if (n === 'jakarta' || /head office|^ho\b/.test(n)) { return 'ho'; }
    if (/^balikpapan/.test(n)) { return 'bpn'; }
    if (/branch|cabang/.test(c)) { return 'branch'; }
    if (/mining|project/.test(c)) { return 'mining'; }
    return 'co';
  }
  var SEGMENTS = [
    { key: 'mining', id: 'Mining Support / Project', en: 'Mining Support / Project' },
    { key: 'ho', id: 'Head Office Jakarta', en: 'Jakarta Head Office' },
    { key: 'bpn', id: 'Balikpapan Hub', en: 'Balikpapan Hub' },
    { key: 'branch', id: 'Cabang', en: 'Branch' },
    { key: 'co', id: 'Contact Office', en: 'Contact Office' }
  ];

  /* Cari total aktivitas bulanan (liter, kWh) di sheet Dashboard. */
  function parseActivityTotals(a) {
    for (var r = 0; r < Math.min(a.length, 60); r++) {
      var cs = -1, cb = -1, cl = -1, row = a[r] || [];
      for (var c = 0; c < row.length; c++) {
        var s = norm(row[c]);
        if (/liter/.test(s) && /solar/.test(s)) { cs = c; }
        else if (/liter/.test(s) && /bensin/.test(s)) { cb = c; }
        else if (/kwh/.test(s) && !/gj|giga/.test(s)) { cl = c; }
      }
      if (cs < 0 || cb < 0 || cl < 0) { continue; }
      var out = {}, n = 0;
      for (var r2 = r + 1; r2 < Math.min(a.length, r + 14); r2++) {
        var m = 0, rr = a[r2] || [];
        for (var c4 = 0; c4 < Math.min(rr.length, cs); c4++) { if (typeof rr[c4] === 'string') { m = monthFromText(rr[c4]); if (m) { break; } } }
        if (!m || out[m]) { continue; }
        out[m] = { solar: isNum(rr[cs]) ? rr[cs] : 0, bensin: isNum(rr[cb]) ? rr[cb] : 0, listrik: isNum(rr[cl]) ? rr[cl] : 0 };
        n++;
      }
      if (n >= 3) { return out; }
    }
    return null;
  }

  function parseScope12(X, wb, fileName, fyStart) {
    var res = { kind: 's12', file: fileName, ok: false, fyStart: fyStart, locations: [], activity: null, activitySource: ['', ''], errors: [], warnings: [], sheetUsed: '' };
    var mats = {};
    wb.SheetNames.forEach(function (n) { try { var m = parseMatrix(sheetAoa(X, wb.Sheets[n])); if (m) { mats[n] = m; } } catch (e) { /* lewati sheet yang tidak bisa dibaca */ } });
    var names = Object.keys(mats);
    var isEm = function (n) { return /tco2|co2e/.test(mats[n].subText) || /emisi|emission|co2/.test(mats[n].headText) || /konversi emisi|emisi co2/.test(norm(n)); };
    var pick = names.filter(function (n) { return /konversi emisi/.test(norm(n)) && isEm(n); })[0]
      || names.filter(function (n) { return /tco2|co2e/.test(mats[n].subText); })[0]
      || names.filter(isEm)[0];
    if (!pick) { res.errors.push('Tidak menemukan sheet emisi per lokasi (misalnya "konversi emisi CO2") dengan kolom Lokasi Area dan bulan.'); return res; }
    var em = mats[pick];
    res.sheetUsed = pick;
    var catMap = {};
    names.forEach(function (n) { if (mats[n].hasCat) { mats[n].rows.forEach(function (rw) { if (rw.cat && !catMap[norm(rw.name)]) { catMap[norm(rw.name)] = rw.cat; } }); } });
    var months = fyMonths(fyStart), keyOf = {};
    months.forEach(function (mo) { keyOf[mo.m] = mo.key; });
    var uncategorized = [];
    em.rows.forEach(function (rw) {
      var cat = rw.cat || catMap[norm(rw.name)] || '';
      if (!cat) { uncategorized.push(rw.name); }
      var loc = { name: rw.name, cat: cat, seg: segmentOf(rw.name, cat), m: {} };
      Object.keys(rw.vals).forEach(function (mn) { loc.m[keyOf[mn]] = rw.vals[mn]; });
      res.locations.push(loc);
    });
    if (uncategorized.length) { res.warnings.push(uncategorized.length + ' lokasi tanpa kategori dimasukkan ke Contact Office: ' + uncategorized.slice(0, 6).join(', ') + (uncategorized.length > 6 ? ', ...' : '') + '.'); }
    if (em.badCells) { res.warnings.push(em.badCells + ' sel berisi teks atau error (misalnya #REF!) dibaca sebagai 0.'); }

    /* Data aktivitas untuk Kat. 3: (a) sheet aktivitas per lokasi, (b) total di Dashboard, (c) perkiraan dari emisi. */
    var emTot = {};
    res.locations.forEach(function (l) { Object.keys(l.m).forEach(function (k) { emTot[k] = emTot[k] || { solar: 0, bensin: 0, listrik: 0 }; emTot[k].solar += l.m[k].solar; emTot[k].bensin += l.m[k].bensin; emTot[k].listrik += l.m[k].listrik; }); });
    var plausible = function (act) {
      var ok = 0, n = 0;
      Object.keys(act).forEach(function (k) {
        var e = emTot[k]; if (!e) { return; }
        [['solar', 0.0015, 0.004], ['bensin', 0.0015, 0.0035], ['listrik', 0.0004, 0.0015]].forEach(function (t) {
          if (e[t[0]] > 0.5 && act[k][t[0]] > 0) { n++; var f = e[t[0]] / act[k][t[0]]; if (f >= t[1] && f <= t[2]) { ok++; } }
        });
      });
      return n > 0 && ok / n >= 0.8;
    };
    var cand = names.filter(function (n) { return n !== pick && !isEm(n) && /\(l\)|liter|kwh/.test(mats[n].subText) && mats[n].rows.length >= 5; });
    for (var i = 0; i < cand.length && !res.activity; i++) {
      var act = {};
      mats[cand[i]].rows.forEach(function (rw) { Object.keys(rw.vals).forEach(function (mn) { var k = keyOf[mn]; act[k] = act[k] || { solar: 0, bensin: 0, listrik: 0 }; act[k].solar += rw.vals[mn].solar; act[k].bensin += rw.vals[mn].bensin; act[k].listrik += rw.vals[mn].listrik; }); });
      if (plausible(act)) { res.activity = act; res.activitySource = ['sheet "' + cand[i] + '" (liter dan kWh per lokasi)', 'sheet "' + cand[i] + '" (litres and kWh by site)']; }
    }
    if (!res.activity) {
      for (var j = 0; j < wb.SheetNames.length && !res.activity; j++) {
        var t = null;
        try { t = parseActivityTotals(sheetAoa(X, wb.Sheets[wb.SheetNames[j]])); } catch (e2) { t = null; }
        if (!t) { continue; }
        var act2 = {};
        Object.keys(t).forEach(function (mn) { if (keyOf[mn]) { act2[keyOf[mn]] = t[mn]; } });
        if (plausible(act2)) { res.activity = act2; res.activitySource = ['sheet "' + wb.SheetNames[j] + '" (total liter dan kWh bulanan)', 'sheet "' + wb.SheetNames[j] + '" (monthly litre and kWh totals)']; }
      }
    }
    if (!res.activity) { res.activitySource = ['diperkirakan dari emisi Scope 1 dan 2 dibagi faktor emisi', 'estimated from Scope 1 and 2 emissions divided by emission factors']; res.warnings.push('Data liter dan kWh tidak terbaca. Kat. 3 dihitung dari perkiraan aktivitas (emisi dibagi faktor).'); }
    res.emTot = emTot;
    res.ok = res.locations.length > 0;
    return res;
  }

  /* ---------- 3. Model gabungan ---------- */
  function buildModel(state) {
    var F = factorMap(state.factors), R = parseRoutes(state.routes), fy = state.fyStart;
    var all = fyMonths(fy), from = state.from == null ? 0 : state.from, to = state.to == null ? 11 : state.to;
    if (from > to) { var tmp = from; from = to; to = tmp; }
    var months = all.slice(from, to + 1), inRange = {};
    months.forEach(function (m) { inRange[m.key] = true; });
    var zero = function () { return { s1: 0, s2: 0, air: 0, cat3: 0, cat4: 0, cat6t: 0, cat6h: 0, cat9: 0, solar: 0, bensin: 0, listrik: 0 }; };
    var M = {}; months.forEach(function (m) { M[m.key] = zero(); });
    var model = { fyStart: fy, months: months, monthly: M, segments: {}, locations: [], vendors: [], detail: [], notes: [], quality: { excludedRows: 0, missingDistance: 0, review: 0, filesOutside: 0, illustrative: 0, defaultFactor: 0 }, hasS12: false, hasVendor: false, activitySource: ['', ''] };
    SEGMENTS.forEach(function (s) { model.segments[s.key] = { s1: 0, s2: 0 }; });

    var s12 = state.s12;
    if (s12 && s12.ok) {
      model.hasS12 = true; model.activitySource = s12.activitySource;
      s12.locations.forEach(function (l) {
        var t1 = 0, t2 = 0;
        Object.keys(l.m).forEach(function (k) {
          if (!inRange[k]) { return; }
          var v = l.m[k];
          M[k].solar += v.solar; M[k].bensin += v.bensin; M[k].listrik += v.listrik;
          M[k].s1 += v.solar + v.bensin; M[k].s2 += v.listrik; M[k].air += v.air;
          t1 += v.solar + v.bensin; t2 += v.listrik;
        });
        model.segments[l.seg].s1 += t1; model.segments[l.seg].s2 += t2;
        model.locations.push({ name: l.name, cat: l.cat, seg: l.seg, s1: t1, s2: t2, total: t1 + t2 });
      });
      model.locations.sort(function (a, b) { return b.total - a.total; });
      months.forEach(function (m) {
        var act = s12.activity && s12.activity[m.key];
        if (!act) {
          var e = M[m.key];
          act = { solar: F['S1|Solar'] ? e.solar * 1000 / F['S1|Solar'] : 0, bensin: F['S1|Bensin'] ? e.bensin * 1000 / F['S1|Bensin'] : 0, listrik: F['S2|Listrik'] ? e.listrik * 1000 / F['S2|Listrik'] : 0 };
        }
        var kg = (act.solar || 0) * (F['WTT|Solar'] || 0) + (act.bensin || 0) * (F['WTT|Bensin'] || 0) + (act.listrik || 0) * (F['WTT|Listrik'] || 0);
        M[m.key].cat3 += kg / 1000;
        M[m.key].act = act;
      });
    }

    (state.vendors || []).forEach(function (v) {
      if (!v.ok) { return; }
      var row = { vendor: v.vendor, type: v.type, period: v.period.key, file: v.file, rows: v.rows.length, excluded: v.excluded.length, t: 0, cat4: 0, cat9: 0, cat6t: 0, cat6h: 0, missing: 0, inRange: !!inRange[v.period.key] };
      model.quality.excludedRows += v.excluded.length;
      if (!row.inRange) { model.quality.filesOutside++; model.vendors.push(row); return; }
      model.hasVendor = true;
      v.rows.forEach(function (r) {
        var c = calcVendorRow(r, F, R);
        if (c.review) { model.quality.review++; }
        if (/default/.test(c.note)) { model.quality.defaultFactor++; }
        if (c.kg == null) { row.missing++; model.quality.missingDistance++; }
        else { M[v.period.key][c.cat] += c.kg / 1000; row[c.cat] += c.kg / 1000; row.t += c.kg / 1000; }
        model.detail.push({ vendor: v.vendor, type: v.type, period: v.period.key, file: v.file, row: r.row, date: r.date || '', ref: r.ref || '', desc: r.desc || '', cat: c.cat, method: c.method, qty: c.qty, unit: c.unit, fkey: c.fkey, factor: c.factor, kg: c.kg, note: c.note });
      });
      model.vendors.push(row);
    });
    model.vendors.sort(function (a, b) { return a.period < b.period ? -1 : a.period > b.period ? 1 : a.vendor.localeCompare(b.vendor); });

    var T = zero();
    months.forEach(function (m) { Object.keys(T).forEach(function (k) { T[k] += M[m.key][k] || 0; }); });
    T.s3 = T.cat3 + T.cat4 + T.cat6t + T.cat6h + T.cat9;
    T.s12 = T.s1 + T.s2;
    T.total = T.s12 + T.s3;
    months.forEach(function (m) { var x = M[m.key]; x.s3 = x.cat3 + x.cat4 + x.cat6t + x.cat6h + x.cat9; x.total = x.s1 + x.s2 + x.s3; });
    model.totals = T;
    model.ratioS3 = T.s12 > 0 ? T.s3 / T.s12 : null;
    (state.factors || []).forEach(function (f) { if (f.status !== 'Resmi') { model.quality.illustrative++; } });
    model.factors = state.factors || [];
    /* Cakupan: bulan dengan data */
    model.coverage = months.map(function (m) {
      var x = M[m.key];
      return { key: m.key, s12: (x.s1 + x.s2) > 0, eks: model.vendors.some(function (v) { return v.inRange && v.type === 'eks' && v.period === m.key; }), trv: model.vendors.some(function (v) { return v.inRange && v.type === 'trv' && v.period === m.key; }) };
    });
    return model;
  }

  var api = { MONTHS_ID: MONTHS_ID, MONTHS_EN: MONTHS_EN, SHORT_ID: SHORT_ID, SHORT_EN: SHORT_EN, DEFAULT_FACTORS: DEFAULT_FACTORS, DEFAULT_ROUTES: DEFAULT_ROUTES, SPEC: SPEC, CATS: CATS, SEGMENTS: SEGMENTS,
    norm: norm, round: round, parseRoutes: parseRoutes, factorMap: factorMap, fyMonths: fyMonths, monthFromText: monthFromText,
    parseVendor: parseVendor, calcVendorRow: calcVendorRow, parseMatrix: parseMatrix, parseScope12: parseScope12, buildModel: buildModel };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  root.HAP = api;
})(typeof window !== 'undefined' ? window : globalThis);
