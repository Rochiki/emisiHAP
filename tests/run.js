/* Uji otomatis mesin hitung emisiHAP.
   Jalankan:  python3 tests/make_synthetic_s12.py /tmp/hap && node tests/run.js /tmp/hap   (butuh paket npm "xlsx") */
const fs = require('fs'), path = require('path');
const X = require(process.env.XLSX_PATH || 'xlsx');
const H = require('../js/calc.js');
const dir = process.argv[2] || '/tmp/hap';
const exp = JSON.parse(fs.readFileSync(path.join(dir, 'expected.json')));
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; } else { fail++; console.log('  GAGAL: ' + msg); } };
const near = (a, b, msg, tol) => ok(Math.abs(a - b) <= (tol || 1e-6) * Math.max(1, Math.abs(b)), msg + ' (dapat ' + a + ', harap ' + b + ')');
const read = (p) => X.read(fs.readFileSync(p));
const S = path.join(__dirname, '..', 'samples');
const F = H.DEFAULT_FACTORS;

console.log('1. Database Scope 1 dan 2 (tiga varian tata letak)');
const srcWord = { a: 'Input data', b: 'Dashboard', c: 'Diperkirakan' };
for (const v of ['a', 'b', 'c']) {
  const r = H.parseScope12(X, read(path.join(dir, 's12_' + v + '.xlsx')), 's12_' + v + '.xlsx', 2026);
  ok(r.ok, v + ': terbaca'); ok(r.sheetUsed === 'konversi emisi CO2', v + ': sheet konversi dipakai, dapat ' + r.sheetUsed);
  ok(r.locations.length === exp[v].locations, v + ': jumlah lokasi ' + r.locations.length);
  ok(r.activitySource[0].toLowerCase().indexOf(srcWord[v].toLowerCase()) >= 0 && r.activitySource[1].length > 0, v + ': sumber aktivitas = ' + r.activitySource);
  const m = H.buildModel({ fyStart: 2026, s12: r, vendors: [], factors: F, routes: H.DEFAULT_ROUTES });
  let s1 = 0, s2 = 0, c3 = 0;
  for (const k of Object.keys(exp[v].months)) {
    const e = exp[v].months[k];
    near(m.monthly[k].s1, e.s1, v + ' ' + k + ' Scope 1'); near(m.monthly[k].s2, e.s2, v + ' ' + k + ' Scope 2');
    const kwh = v === 'c' ? e.s2 * 1000 / 0.85 : e.kwh;
    const want = (e.solarL * 0.61 + e.bensinL * 0.60 + kwh * 0.10) / 1000;
    near(m.monthly[k].cat3, want, v + ' ' + k + ' Kat 3', 1e-6);
    s1 += e.s1; s2 += e.s2; c3 += want;
  }
  near(m.totals.s1, s1, v + ' total Scope 1'); near(m.totals.s2, s2, v + ' total Scope 2'); near(m.totals.cat3, c3, v + ' total Kat 3');
  for (const sg of Object.keys(exp[v].seg)) { near(m.segments[sg].s1 + m.segments[sg].s2, exp[v].seg[sg], v + ' segmen ' + sg); }
  near(Object.values(m.segments).reduce((a, x) => a + x.s1 + x.s2, 0), m.totals.s12, v + ' jumlah segmen = total');
  ok(r.warnings.some(w => /tanpa kategori/.test(w)), v + ': peringatan lokasi tanpa kategori');
  ok(r.warnings.some(w => /#REF|teks atau error/.test(w)), v + ': peringatan sel error');
  const m2 = H.buildModel({ fyStart: 2026, from: 2, to: 4, s12: r, vendors: [], factors: F, routes: '' });
  near(m2.totals.s1, ['2026-06', '2026-07', '2026-08'].reduce((a, k) => a + exp[v].months[k].s1, 0), v + ' rentang Jun-Agu');
  ok(m2.months.length === 3, v + ' rentang 3 bulan');
}

console.log('2. Laporan vendor');
const eks = H.parseVendor(X, read(path.join(S, 'Contoh_Ekspedisi_BENAR.xlsx')), 'eks.xlsx');
const trv = H.parseVendor(X, read(path.join(S, 'Contoh_Travel_BENAR.xlsx')), 'trv.xlsx');
const bad = H.parseVendor(X, read(path.join(S, 'Contoh_Ekspedisi_ADA_KESALAHAN.xlsx')), 'bad.xlsx');
ok(eks.ok && eks.type === 'eks' && eks.period.key === '2026-10' && eks.rows.length === 5, 'ekspedisi terbaca 5 baris');
ok(trv.ok && trv.type === 'trv' && trv.rows.length === 5, 'travel terbaca 5 baris');
ok(bad.ok && bad.rows.length === 1 && bad.excluded.length === 4, 'file bermasalah: 1 dihitung, 4 ditolak (dapat ' + bad.rows.length + '/' + bad.excluded.length + ')');
let m = H.buildModel({ fyStart: 2026, s12: null, vendors: [eks, trv], factors: F, routes: H.DEFAULT_ROUTES });
near(m.totals.cat4, 1.6899, 'Kat 4 = kalkulator Excel', 1e-9); near(m.totals.cat9, 3.1608, 'Kat 9 = kalkulator Excel', 1e-9);
near(m.totals.cat6t, 0.4732, 'Kat 6 transportasi = kalkulator Excel', 1e-9); near(m.totals.cat6h, 0.1, 'Kat 6 hotel = kalkulator Excel', 1e-9);
near(m.totals.s3, 5.4239, 'Total Scope 3 = kalkulator Excel', 1e-9);
ok(m.quality.missingDistance === 1 && m.quality.review === 1, 'kualitas: 1 tanpa jarak, 1 tinjau');
ok(m.detail.length === 10, 'detail 10 baris'); ok(m.ratioS3 === null, 'rasio kosong tanpa Scope 1-2');
near(m.monthly['2026-10'].s3, 5.4239, 'emisi tercatat di Oktober', 1e-9); near(m.monthly['2026-09'].s3, 0, 'September nol');
m = H.buildModel({ fyStart: 2026, s12: null, vendors: [eks, trv], factors: F, routes: H.DEFAULT_ROUTES + '\nBPN-TGC=600' });
near(m.totals.cat6t, 0.4732 + 600 * 0.15 / 1000, 'rute baru ikut dihitung', 1e-9); ok(m.quality.missingDistance === 0, 'tidak ada jarak hilang');
const F2 = F.map(f => Object.assign({}, f, f.key === 'HOTEL|malam' ? { value: 30, status: 'Resmi' } : {}));
m = H.buildModel({ fyStart: 2026, s12: null, vendors: [trv], factors: F2, routes: H.DEFAULT_ROUTES });
near(m.totals.cat6h, 0.15, 'faktor hotel diubah', 1e-9); ok(m.quality.illustrative === F.length - 1, 'hitungan faktor ilustrasi');
m = H.buildModel({ fyStart: 2025, s12: null, vendors: [eks], factors: F, routes: '' });
ok(m.totals.s3 === 0 && m.quality.filesOutside === 1 && !m.hasVendor, 'file di luar tahun fiskal tidak dihitung');
m = H.buildModel({ fyStart: 2026, from: 0, to: 5, s12: null, vendors: [eks], factors: F, routes: '' });
ok(m.totals.s3 === 0, 'file di luar rentang bulan tidak dihitung');
m = H.buildModel({ fyStart: 2026, from: 8, to: 3, s12: null, vendors: [eks], factors: F, routes: '' });
ok(m.months.length === 6 && m.totals.cat4 > 0, 'rentang terbalik ditukar');

console.log('3. Gabungan dan kasus tepi');
const s12 = H.parseScope12(X, read(path.join(dir, 's12_b.xlsx')), 's.xlsx', 2026);
m = H.buildModel({ fyStart: 2026, s12: s12, vendors: [eks, trv], factors: F, routes: H.DEFAULT_ROUTES });
near(m.totals.total, m.totals.s1 + m.totals.s2 + m.totals.s3, 'total = S1+S2+S3');
near(m.totals.s3, m.totals.cat3 + 5.4239, 'S3 = Kat 3 + vendor');
near(Object.values(m.monthly).reduce((a, x) => a + x.total, 0), m.totals.total, 'jumlah bulanan = total');
ok(m.ratioS3 > 0 && isFinite(m.ratioS3), 'rasio terisi');
ok(m.coverage.filter(c => c.s12).length === 7 && m.coverage.filter(c => c.eks).length === 1, 'cakupan bulan');
const wbEmpty = X.utils.book_new(); X.utils.book_append_sheet(wbEmpty, X.utils.aoa_to_sheet([['a', 'b'], [1, 2]]), 'Sheet1');
const e1 = H.parseScope12(X, wbEmpty, 'x.xlsx', 2026); ok(!e1.ok && e1.errors.length === 1, 'file asing ditolak dengan pesan');
const wbL = X.utils.book_new(); X.utils.book_append_sheet(wbL, X.utils.aoa_to_sheet([['x']]), 'Laporan');
const e2 = H.parseVendor(X, wbL, 'x.xlsx'); ok(!e2.ok && e2.errors.length === 1, 'sheet Laporan kosong ditolak');
const tpl = H.parseVendor(X, read(path.join(S, 'Contoh_Ekspedisi_BENAR.xlsx')), 't.xlsx');
const wbT = read(path.join(S, 'Contoh_Ekspedisi_BENAR.xlsx')); wbT.Sheets['Laporan']['C4'].v = 'Oktobre';
ok(!H.parseVendor(X, wbT, 't.xlsx').ok, 'nama bulan salah ditolak');
m = H.buildModel({ fyStart: 2026, s12: null, vendors: [], factors: [], routes: '' });
ok(m.totals.total === 0 && !m.hasS12 && !m.hasVendor, 'model kosong aman');
m = H.buildModel({ fyStart: 2026, s12: s12, vendors: [eks, trv], factors: [], routes: '' });
ok(m.totals.s3 === 0 && isFinite(m.totals.total) && m.quality.missingDistance === 10, 'tanpa faktor: tidak error, Scope 3 nol');
ok(H.monthFromText('Emisi CO2e April') === 4 && H.monthFromText('Sept') === 9 && H.monthFromText('Juni ') === 6 && H.monthFromText('Total') === 0 && H.monthFromText('Agustus') === 8 && H.monthFromText('Des') === 12, 'pengenalan nama bulan');
ok(Object.keys(H.parseRoutes('cgk - bpn = 1.260,5\nrusak\nAAA-BBB=0')).length === 1, 'parse rute tahan salah ketik');

console.log('\nLULUS ' + pass + ', GAGAL ' + fail);
process.exit(fail ? 1 : 0);
