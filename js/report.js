/* emisiHAP - laporan manajemen dwibahasa (Word) dan kertas kerja (Excel). */
(function (root) {
  'use strict';
  var H = root.HAP, Ch = root.HAPCharts;
  var ORANGE = 'F37022', INK = '231F20', MUTED = '6F6F72', SOFT = 'F4F4F3', LINE = 'D9D9D6', RED = 'B3261E';
  var FONT = 'Arial', W = 9026; /* lebar isi A4, margin 1 inci (DXA) */

  function nID(n, d) { return new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0); }
  function nEN(n, d) { return new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n || 0); }
  function pct(a, b) { return b > 0 ? 100 * a / b : 0; }
  function mLabel(key, lang, short) { var p = key.split('-'), m = +p[1] - 1; return (short ? (lang === 'en' ? H.SHORT_EN : H.SHORT_ID) : (lang === 'en' ? H.MONTHS_EN : H.MONTHS_ID))[m] + ' ' + p[0]; }
  function rangeLabel(model, lang) {
    var a = model.months[0].key, b = model.months[model.months.length - 1].key;
    return a === b ? mLabel(a, lang) : mLabel(a, lang) + ' - ' + mLabel(b, lang);
  }
  function fyLabel(model) { return 'FY' + model.fyStart + ' (Apr ' + model.fyStart + ' - Mar ' + (model.fyStart + 1) + ')'; }
  function chartLabels(model) {
    return model.months.map(function (m) { var a = H.SHORT_ID[m.m - 1], b = H.SHORT_EN[m.m - 1]; return (a === b ? a : a + '/' + b) + " '" + String(m.y).slice(2); });
  }
  function dataUrlBytes(url) {
    var bin = atob(url.split(',')[1]), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { out[i] = bin.charCodeAt(i); }
    return out;
  }
  function topCat(model) {
    var best = null;
    H.CATS.forEach(function (c) { if (!best || model.totals[c.key] > model.totals[best.key]) { best = c; } });
    return best;
  }
  function peakMonth(model) {
    var best = model.months[0];
    model.months.forEach(function (m) { if (model.monthly[m.key].total > model.monthly[best.key].total) { best = m; } });
    return best;
  }

  /* Poin ringkasan, catatan kualitas, rekomendasi: masing-masing [id, en]. */
  function narrative(model) {
    var T = model.totals, q = model.quality, out = { summary: [], quality: [], actions: [] };
    out.summary.push([
      'Total emisi GRK periode ' + rangeLabel(model, 'id') + ' adalah ' + nID(T.total, 1) + ' tCO2e: Scope 1 ' + nID(T.s1, 1) + ' (' + nID(pct(T.s1, T.total), 0) + '%), Scope 2 ' + nID(T.s2, 1) + ' (' + nID(pct(T.s2, T.total), 0) + '%), dan Scope 3 ' + nID(T.s3, 1) + ' (' + nID(pct(T.s3, T.total), 0) + '%).',
      'Total GHG emissions for ' + rangeLabel(model, 'en') + ' were ' + nEN(T.total, 1) + ' tCO2e: Scope 1 ' + nEN(T.s1, 1) + ' (' + nEN(pct(T.s1, T.total), 0) + '%), Scope 2 ' + nEN(T.s2, 1) + ' (' + nEN(pct(T.s2, T.total), 0) + '%), and Scope 3 ' + nEN(T.s3, 1) + ' (' + nEN(pct(T.s3, T.total), 0) + '%).'
    ]);
    if (!model.hasS12) {
      out.summary.push(['Database Scope 1 dan 2 belum dimuat, sehingga angka Scope 1, Scope 2, dan Kategori 3 belum tersedia.', 'The Scope 1 and 2 database has not been loaded, so Scope 1, Scope 2 and Category 3 figures are not yet available.']);
    }
    if (T.s3 > 0) {
      var c = topCat(model);
      out.summary.push([
        'Scope 3 yang sudah terukur setara ' + (model.ratioS3 == null ? '-' : nID(100 * model.ratioS3, 1)) + '% dari Scope 1 dan 2. Penyumbang terbesar: ' + c.id + ' sebesar ' + nID(T[c.key], 1) + ' tCO2e (' + nID(pct(T[c.key], T.s3), 0) + '% dari Scope 3).',
        'Measured Scope 3 equals ' + (model.ratioS3 == null ? '-' : nEN(100 * model.ratioS3, 1)) + '% of Scope 1 and 2. Largest contributor: ' + c.en + ' at ' + nEN(T[c.key], 1) + ' tCO2e (' + nEN(pct(T[c.key], T.s3), 0) + '% of Scope 3).'
      ]);
    }
    if (model.months.length > 1 && T.total > 0) {
      var pk = peakMonth(model);
      out.summary.push([
        'Bulan tertinggi adalah ' + mLabel(pk.key, 'id') + ' dengan ' + nID(model.monthly[pk.key].total, 1) + ' tCO2e.',
        'The highest month was ' + mLabel(pk.key, 'en') + ' at ' + nEN(model.monthly[pk.key].total, 1) + ' tCO2e.'
      ]);
    }
    if (model.hasS12) {
      var seg = null;
      H.SEGMENTS.forEach(function (s) { var v = model.segments[s.key].s1 + model.segments[s.key].s2; if (!seg || v > seg.v) { seg = { s: s, v: v }; } });
      if (seg && seg.v > 0) {
        out.summary.push([
          'Segmen penyumbang Scope 1 dan 2 terbesar adalah ' + seg.s.id + ': ' + nID(seg.v, 1) + ' tCO2e (' + nID(pct(seg.v, T.s12), 0) + '%).',
          'The largest Scope 1 and 2 segment is ' + seg.s.en + ': ' + nEN(seg.v, 1) + ' tCO2e (' + nEN(pct(seg.v, T.s12), 0) + '%).'
        ]);
      }
    }
    out.summary.push([
      'Scope 3 baru mencakup Kategori 3, 4, 6 dan 9. Kategori lain belum dihitung, sehingga angka Scope 3 adalah batas bawah.',
      'Scope 3 currently covers Categories 3, 4, 6 and 9 only. Other categories are not yet quantified, so the Scope 3 figure is a lower bound.'
    ]);

    if (q.illustrative > 0) {
      out.quality.push([q.illustrative + ' faktor emisi masih berstatus ilustrasi dan belum diverifikasi ke sumber resmi. Angka Scope 3 pada laporan ini bersifat DRAF.', q.illustrative + (q.illustrative === 1 ? ' emission factor is' : ' emission factors are') + ' still illustrative and not yet verified against official sources. Scope 3 figures in this report are DRAFT.']);
    } else {
      out.quality.push(['Seluruh faktor emisi berstatus resmi dengan sumber tercatat.', 'All emission factors are marked official with recorded sources.']);
    }
    var nEks = model.coverage.filter(function (c) { return c.eks; }).length, nTrv = model.coverage.filter(function (c) { return c.trv; }).length, nS = model.coverage.filter(function (c) { return c.s12; }).length, nM = model.months.length;
    out.quality.push([
      'Cakupan data: Scope 1 dan 2 tersedia ' + nS + ' dari ' + nM + ' bulan, laporan ekspedisi ' + nEks + ' dari ' + nM + ' bulan, laporan travel agent ' + nTrv + ' dari ' + nM + ' bulan.',
      'Data coverage: Scope 1 and 2 available for ' + nS + ' of ' + nM + ' months, freight vendor reports for ' + nEks + ' of ' + nM + ' months, travel agent reports for ' + nTrv + ' of ' + nM + ' months.'
    ]);
    if (q.excludedRows) { out.quality.push([q.excludedRows + ' baris data vendor tidak dihitung karena isinya belum benar.', q.excludedRows + (q.excludedRows === 1 ? ' vendor data row was' : ' vendor data rows were') + ' excluded because of invalid entries.']); }
    if (q.missingDistance) { out.quality.push([q.missingDistance + ' perjalanan tidak dihitung karena jarak rute belum tersedia.', q.missingDistance + (q.missingDistance === 1 ? ' trip was' : ' trips were') + ' not calculated because route distance is unavailable.']); }
    if (q.review) { out.quality.push([q.review + ' pengiriman berpembayar HCM atau pihak lain perlu ditinjau kategorinya (Kategori 4 atau 9).', q.review + (q.review === 1 ? ' shipment paid by HCM or another party needs' : ' shipments paid by HCM or other parties need') + ' a category review (Category 4 or 9).']); }
    if (q.defaultFactor) { out.quality.push([q.defaultFactor + ' baris memakai faktor default karena jenis armada atau kelas tidak dikenali.', q.defaultFactor + (q.defaultFactor === 1 ? ' row' : ' rows') + ' used a default factor because vehicle type or class was not recognised.']); }
    if (model.hasS12) { out.quality.push(['Sumber data aktivitas untuk Kategori 3: ' + model.activitySource[0] + '.', 'Activity data source for Category 3: ' + model.activitySource[1] + '.']); }

    if (q.illustrative > 0) { out.actions.push(['Tetapkan faktor emisi resmi (misalnya IPCC, faktor nasional, DEFRA, GLEC) dan catat sumbernya sebelum angka dipublikasikan.', 'Adopt official emission factors (e.g. IPCC, national factors, DEFRA, GLEC) and record their sources before figures are published.']); }
    if (nEks < nM || nTrv < nM) { out.actions.push(['Lengkapi laporan vendor untuk bulan yang belum ada, dan pastikan pengingat otomatis berjalan.', 'Complete vendor reports for missing months and keep the automatic reminders running.']); }
    if (q.excludedRows || q.missingDistance) { out.actions.push(['Minta vendor memperbaiki baris yang ditolak dan mengisi jarak untuk rute yang belum dikenal.', 'Ask vendors to correct rejected rows and provide distances for unrecognised routes.']); }
    out.actions.push(['Perluas cakupan Scope 3 secara bertahap sesuai hasil screening (misalnya Kategori 5, 7, dan 11).', 'Extend Scope 3 coverage in phases based on the screening results (e.g. Categories 5, 7 and 11).']);
    out.actions.push(['Tetapkan target penurunan dan pemilik program untuk sumber emisi terbesar.', 'Set reduction targets and programme owners for the largest emission sources.']);
    return out;
  }

  /* ---------- Word ---------- */
  function buildDocx(model, images, meta) {
    var D = root.docx, N = narrative(model), T = model.totals, draft = model.quality.illustrative > 0;
    var run = function (t, o) { o = o || {}; return new D.TextRun({ text: String(t), font: FONT, size: o.size || 20, bold: !!o.bold, italics: !!o.italics, color: o.color || INK }); };
    var para = function (t, o) { o = o || {}; return new D.Paragraph({ children: Array.isArray(t) ? t : [run(t, o)], alignment: o.align || D.AlignmentType.LEFT, spacing: { before: o.before == null ? 0 : o.before, after: o.after == null ? 100 : o.after, line: 276 }, keepNext: !!o.keepNext }); };
    var border = { style: D.BorderStyle.SINGLE, size: 4, color: LINE }, none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    var borders = { top: border, bottom: border, left: border, right: border };
    var cell = function (children, w, o) {
      o = o || {};
      return new D.TableCell({ children: children, width: { size: w, type: D.WidthType.DXA }, borders: o.noBorder ? { top: none, bottom: none, left: none, right: none } : borders,
        shading: o.fill ? { fill: o.fill, type: D.ShadingType.CLEAR, color: 'auto' } : undefined, margins: { top: 70, bottom: 70, left: 110, right: 110 }, verticalAlign: o.top ? D.VerticalAlign.TOP : D.VerticalAlign.CENTER, columnSpan: o.span });
    };
    var h1 = function (id, en) {
      return new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 }, keepNext: true, border: { bottom: { style: D.BorderStyle.SINGLE, size: 8, color: ORANGE, space: 4 } },
        children: [run(id, { size: 26, bold: true }), run('  /  ' + en, { size: 22, color: MUTED })] });
    };
    /* Narasi dua kolom: Indonesia | English */
    var bi = function (pairs, bullets) {
      var w = W / 2, mk = function (t, i) { return para((bullets ? (i + 1) + '. ' : '') + t, { after: 110 }); };
      return new D.Table({ width: { size: W, type: D.WidthType.DXA }, columnWidths: [w, w], rows: [
        new D.TableRow({ children: [cell([para('BAHASA INDONESIA', { size: 16, bold: true, color: ORANGE, after: 0 })], w, { fill: SOFT }), cell([para('ENGLISH', { size: 16, bold: true, color: ORANGE, after: 0 })], w, { fill: SOFT })] }),
        new D.TableRow({ children: [cell(pairs.map(function (p, i) { return mk(p[0], i); }), w, { top: true }), cell(pairs.map(function (p, i) { return mk(p[1], i); }), w, { top: true })] })
      ] });
    };
    /* Tabel data: head = [teks], widths = DXA, rows = [[teks|{t,bold,right}]] */
    var table = function (head, widths, rows, opt) {
      opt = opt || {};
      var hr = new D.TableRow({ tableHeader: true, children: head.map(function (h, i) { return cell([para(h, { size: 17, bold: true, color: 'FFFFFF', after: 0, keepNext: !!opt.keep, align: i === 0 ? D.AlignmentType.LEFT : D.AlignmentType.RIGHT })], widths[i], { fill: INK }); }) });
      var body = rows.map(function (r, ri) {
        var total = opt.totalRow && ri === rows.length - 1;
        return new D.TableRow({ cantSplit: true, children: r.map(function (v, i) { return cell([para(v, { size: 18, bold: total, after: 0, keepNext: !!opt.keep && ri < rows.length - 1, align: i === 0 || (opt.left || []).indexOf(i) >= 0 ? D.AlignmentType.LEFT : D.AlignmentType.RIGHT })], widths[i], { fill: total ? SOFT : undefined }); }) });
      });
      return new D.Table({ width: { size: W, type: D.WidthType.DXA }, columnWidths: widths, rows: [hr].concat(body) });
    };
    var image = function (bytes, w, h) { return new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 120, after: 120 }, children: [new D.ImageRun({ data: bytes, transformation: { width: w, height: h } })] }); };
    var gap = function () { return para('', { after: 60 }); };
    var kids = [];

    /* Kop */
    kids.push(new D.Paragraph({ spacing: { after: 160 }, children: [new D.ImageRun({ data: images.logo, transformation: { width: 150, height: Math.round(150 * images.logoRatio) } })] }));
    kids.push(para('Laporan Manajemen Emisi Gas Rumah Kaca', { size: 36, bold: true, after: 20 }));
    kids.push(para('Greenhouse Gas Emissions Management Report', { size: 26, color: MUTED, after: 160 }));
    kids.push(table(['Informasi / Information', ''], [3000, W - 3000], [
      ['Perusahaan / Company', 'PT Hexindo Adiperkasa Tbk'],
      ['Periode / Period', rangeLabel(model, 'id') + '  /  ' + rangeLabel(model, 'en')],
      ['Tahun fiskal / Fiscal year', fyLabel(model)],
      ['Cakupan / Coverage', 'Scope 1, Scope 2, Scope 3 (Kategori / Categories 3, 4, 6, 9)'],
      ['Disusun oleh / Prepared by', meta.preparedBy],
      ['Tanggal terbit / Issued', meta.dateId + '  /  ' + meta.dateEn]
    ], { left: [1] }));
    if (draft) {
      kids.push(gap());
      kids.push(new D.Table({ width: { size: W, type: D.WidthType.DXA }, columnWidths: [W], rows: [new D.TableRow({ children: [cell([
        para('DRAF: faktor emisi belum diverifikasi. Jangan dipakai untuk pelaporan eksternal.', { bold: true, color: RED, after: 30 }),
        para('DRAFT: emission factors not yet verified. Not for external reporting.', { color: RED, after: 0 })], W, { fill: 'FDECEA' })] })] }));
    }

    kids.push(h1('1. Ringkasan Eksekutif', 'Executive Summary'));
    kids.push(bi(N.summary, true));
    kids.push(gap());
    kids.push(table(['Lingkup / Scope', 'tCO2e', '% total'], [5226, 2000, 1800], [
      ['Scope 1: bahan bakar (solar, bensin) / fuels (diesel, gasoline)', nID(T.s1, 1), nID(pct(T.s1, T.total), 1) + '%'],
      ['Scope 2: listrik / purchased electricity', nID(T.s2, 1), nID(pct(T.s2, T.total), 1) + '%'],
      ['Scope 3: rantai nilai (terukur) / value chain (measured)', nID(T.s3, 1), nID(pct(T.s3, T.total), 1) + '%'],
      ['Total', nID(T.total, 1), '100,0%']
    ], { totalRow: true, keep: true }));
    kids.push(para('Format angka: titik = ribuan, koma = desimal. / Number format: dot = thousands, comma = decimal.', { size: 16, color: MUTED, before: 60 }));

    kids.push(h1('2. Tren Bulanan', 'Monthly Trend'));
    kids.push(image(images.trend, 600, Math.round(600 * 620 / 1400)));
    var mw = [2226, 1300, 1300, 1300, 1400, 1500];
    kids.push(table(['Bulan / Month', 'Scope 1', 'Scope 2', 'Scope 3', 'Total', 'S3 / S1+2'], mw, model.months.map(function (m) {
      var d = model.monthly[m.key], s12 = d.s1 + d.s2;
      return [mLabel(m.key, 'id', true) + ' / ' + mLabel(m.key, 'en', true), nID(d.s1, 1), nID(d.s2, 1), nID(d.s3, 1), nID(d.total, 1), s12 > 0 ? nID(100 * d.s3 / s12, 1) + '%' : '-'];
    }).concat([['Total', nID(T.s1, 1), nID(T.s2, 1), nID(T.s3, 1), nID(T.total, 1), T.s12 > 0 ? nID(100 * T.s3 / T.s12, 1) + '%' : '-']]), { totalRow: true }));

    kids.push(h1('3. Scope 1 dan 2', 'Scope 1 and 2'));
    if (model.hasS12) {
      kids.push(bi([['Emisi Scope 1 dan 2 diambil dari database energi HAP Nasional (solar, bensin, listrik per lokasi per bulan). Lokasi dikelompokkan menjadi lima segmen.', 'Scope 1 and 2 emissions are taken from the HAP national energy database (diesel, gasoline and electricity by site and month). Sites are grouped into five segments.']]));
      kids.push(gap());
      kids.push(image(images.seg, 600, Math.round(600 * images.segRatio)));
      kids.push(table(['Segmen / Segment', 'Scope 1', 'Scope 2', 'Total', '%'], [3426, 1400, 1400, 1400, 1400], H.SEGMENTS.map(function (s) {
        var v = model.segments[s.key];
        return [s.id === s.en ? s.id : s.id + ' / ' + s.en, nID(v.s1, 1), nID(v.s2, 1), nID(v.s1 + v.s2, 1), nID(pct(v.s1 + v.s2, T.s12), 1) + '%'];
      }).concat([['Total', nID(T.s1, 1), nID(T.s2, 1), nID(T.s12, 1), '100,0%']]), { totalRow: true }));
      kids.push(gap());
      kids.push(para('Sepuluh lokasi terbesar / Top ten sites', { bold: true, keepNext: true }));
      kids.push(table(['Lokasi / Site', 'Scope 1', 'Scope 2', 'Total', '%'], [3426, 1400, 1400, 1400, 1400], model.locations.slice(0, 10).map(function (l) {
        return [l.name, nID(l.s1, 1), nID(l.s2, 1), nID(l.total, 1), nID(pct(l.total, T.s12), 1) + '%'];
      })));
    } else {
      kids.push(bi([['Database Scope 1 dan 2 belum dimuat pada saat laporan ini dibuat.', 'The Scope 1 and 2 database was not loaded when this report was generated.']]));
    }

    kids.push(h1('4. Scope 3', 'Scope 3'));
    kids.push(image(images.cat, 600, Math.round(600 * images.catRatio)));
    var method = { cat3: 'Liter dan kWh Scope 1 dan 2 x faktor hulu / Scope 1-2 litres and kWh x upstream factor', cat4: 'BBM aktual atau ton-km / Actual fuel or tonne-km', cat9: 'BBM aktual atau ton-km / Actual fuel or tonne-km', cat6t: 'Jarak x faktor moda / Distance x mode factor', cat6h: 'Kamar-malam x faktor / Room-nights x factor' };
    kids.push(table(['Kategori / Category', 'Metode / Method', 'tCO2e', '%'], [3326, 3300, 1300, 1100], H.CATS.map(function (c) {
      return [c.id + ' / ' + c.en, method[c.key], nID(T[c.key], 2), nID(pct(T[c.key], T.s3), 1) + '%'];
    }).concat([['Total Scope 3', '', nID(T.s3, 2), T.s3 > 0 ? '100,0%' : '-']]), { totalRow: true, left: [1] }));
    kids.push(gap());
    kids.push(bi([[
      'Keterkaitan dengan Scope 1 dan 2: Kategori 3 dihitung langsung dari konsumsi solar, bensin, dan listrik yang sama dengan Scope 1 dan 2, sehingga naik turun mengikuti keduanya. Pengiriman memakai kendaraan milik Hexindo sudah tercatat di Scope 1 dan tidak dihitung lagi di Kategori 4.',
      'Link to Scope 1 and 2: Category 3 is derived directly from the same diesel, gasoline and electricity consumption as Scope 1 and 2, so it moves with them. Deliveries using Hexindo-owned vehicles are already in Scope 1 and are not counted again in Category 4.'
    ]]));
    var vin = model.vendors.filter(function (v) { return v.inRange; });
    if (vin.length) {
      kids.push(gap());
      kids.push(para('Laporan vendor yang dihitung / Vendor reports included', { bold: true, keepNext: true }));
      kids.push(table(['Vendor', 'Jenis / Type', 'Periode / Period', 'Baris / Rows', 'tCO2e'], [3026, 1700, 1700, 1200, 1400], vin.map(function (v) {
        return [v.vendor, v.type === 'eks' ? 'Ekspedisi / Freight' : 'Travel agent', mLabel(v.period, 'id', true), String(v.rows) + (v.excluded || v.missing ? ' (-' + (v.excluded + v.missing) + ')' : ''), nID(v.t, 3)];
      }), { left: [1, 2] }));
      kids.push(para('Angka dalam kurung = baris yang tidak dihitung. / Figure in brackets = rows not calculated.', { size: 16, color: MUTED, before: 60 }));
    }

    kids.push(h1('5. Metodologi dan Batasan', 'Methodology and Boundaries'));
    kids.push(bi([
      ['Standar: GHG Protocol Corporate Standard dan Corporate Value Chain (Scope 3) Standard. Satuan tCO2e.', 'Standards: GHG Protocol Corporate Standard and Corporate Value Chain (Scope 3) Standard. Unit tCO2e.'],
      ['Batas organisasi: seluruh lokasi operasi PT Hexindo Adiperkasa Tbk yang tercatat di database energi nasional.', 'Organisational boundary: all PT Hexindo Adiperkasa Tbk operating sites recorded in the national energy database.'],
      ['Scope 3 dihitung dari laporan bulanan vendor ekspedisi dan travel agent, serta data energi Scope 1 dan 2 untuk Kategori 3. Emisi dicatat pada periode laporan vendor.', 'Scope 3 is calculated from monthly freight vendor and travel agent reports, plus Scope 1 and 2 energy data for Category 3. Emissions are recorded in the vendor reporting period.'],
      ['Kategori 4 dan 9 dibedakan menurut pembayar ongkos angkut. Bila vendor melaporkan BBM aktual, angka itu dipakai. Bila tidak, dipakai ton-km dikali faktor jenis armada.', 'Categories 4 and 9 are split by who pays the freight. Where the vendor reports actual fuel, it is used; otherwise tonne-km times a vehicle-type factor.'],
      ['Kategori yang belum dihitung: 1, 2, 5, 7, 8, 11, 12, 13. Kategori 10, 14, 15 dinilai tidak relevan.', 'Categories not yet quantified: 1, 2, 5, 7, 8, 11, 12, 13. Categories 10, 14 and 15 are assessed as not relevant.']
    ], true));

    kids.push(h1('6. Kualitas Data', 'Data Quality'));
    kids.push(bi(N.quality, true));
    kids.push(gap());
    kids.push(para('Cakupan data per bulan / Data coverage by month', { bold: true, keepNext: true }));
    var yes = 'Ada / Yes', no = '-';
    kids.push(table(['Bulan / Month', 'Scope 1 & 2', 'Ekspedisi / Freight', 'Travel agent'], [2826, 2000, 2200, 2000], model.coverage.map(function (c) {
      return [mLabel(c.key, 'id', true) + ' / ' + mLabel(c.key, 'en', true), c.s12 ? yes : no, c.eks ? yes : no, c.trv ? yes : no];
    })));

    kids.push(h1('7. Tindak Lanjut', 'Next Steps'));
    kids.push(bi(N.actions, true));

    kids.push(h1('Lampiran: Faktor Emisi', 'Appendix: Emission Factors'));
    kids.push(table(['Faktor / Factor', 'Satuan / Unit', 'kgCO2e', 'Status', 'Sumber / Source'], [3526, 1500, 1000, 1100, 1900], model.factors.map(function (f) {
      return [f.id + ' / ' + f.en, f.unit, nID(+f.value, 3), f.status === 'Resmi' ? 'Resmi / Official' : 'Ilustrasi / Illustrative', f.source || '-'];
    }), { left: [1, 3, 4] }));

    var footer = new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [run('PT Hexindo Adiperkasa Tbk  |  QSHE Department  |  ', { size: 16, color: MUTED }), new D.TextRun({ children: [D.PageNumber.CURRENT], font: FONT, size: 16, color: MUTED })] })] });
    var header = new D.Header({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [run((draft ? 'DRAF / DRAFT  |  ' : '') + 'Laporan Emisi GRK / GHG Emissions Report  |  ' + rangeLabel(model, 'en'), { size: 16, color: draft ? RED : MUTED })] })] });
    return new D.Document({
      creator: 'QSHE PT Hexindo Adiperkasa Tbk', title: 'Laporan Manajemen Emisi GRK / GHG Emissions Management Report',
      styles: { default: { document: { run: { font: FONT, size: 20 } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1300, left: 1440 } } }, headers: { default: header }, footers: { default: footer }, children: kids }]
    });
  }

  /* ---------- Excel ---------- */
  function buildWorkbook(model, X) {
    var wb = X.utils.book_new(), T = model.totals, r4 = function (n) { return H.round(n || 0, 4); };
    var add = function (name, aoa, widths) { var ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = widths.map(function (w) { return { wch: w }; }); X.utils.book_append_sheet(wb, ws, name); };
    add('Ringkasan', [
      ['Rekap Emisi GRK PT Hexindo Adiperkasa Tbk'], ['Periode', rangeLabel(model, 'id')], ['Tahun fiskal', fyLabel(model)], ['Status faktor', model.quality.illustrative > 0 ? 'DRAF: ' + model.quality.illustrative + ' faktor masih ilustrasi' : 'Semua faktor resmi'], [],
      ['Lingkup', 'tCO2e'], ['Scope 1', r4(T.s1)], ['Scope 2', r4(T.s2)]
    ].concat(H.CATS.map(function (c) { return ['Scope 3 - ' + c.id, r4(T[c.key])]; })).concat([['Total Scope 3', r4(T.s3)], ['Total Scope 1+2+3', r4(T.total)], ['Rasio Scope 3 terhadap Scope 1+2', model.ratioS3 == null ? '' : r4(model.ratioS3)]]), [48, 18]);
    add('Bulanan', [['Bulan', 'Solar (tCO2e)', 'Bensin (tCO2e)', 'Scope 1', 'Scope 2', 'Kat 3', 'Kat 4', 'Kat 6 transportasi', 'Kat 6 hotel', 'Kat 9', 'Scope 3', 'Total']].concat(model.months.map(function (m) {
      var d = model.monthly[m.key];
      return [m.key, r4(d.solar), r4(d.bensin), r4(d.s1), r4(d.s2), r4(d.cat3), r4(d.cat4), r4(d.cat6t), r4(d.cat6h), r4(d.cat9), r4(d.s3), r4(d.total)];
    })), [10, 14, 14, 12, 12, 12, 12, 18, 12, 12, 12, 12]);
    add('Scope12_Lokasi', [['Lokasi', 'Kategori', 'Segmen', 'Scope 1 (tCO2e)', 'Scope 2 (tCO2e)', 'Total']].concat(model.locations.map(function (l) {
      var s = H.SEGMENTS.filter(function (x) { return x.key === l.seg; })[0];
      return [l.name, l.cat, s ? s.id : l.seg, r4(l.s1), r4(l.s2), r4(l.total)];
    })), [30, 24, 26, 16, 16, 12]);
    add('Scope3_Detail', [['Vendor', 'Jenis', 'Periode', 'File', 'Baris Excel', 'Tanggal', 'Referensi', 'Uraian', 'Kategori', 'Metode', 'Jumlah', 'Satuan', 'Kunci faktor', 'Faktor (kgCO2e)', 'Emisi (kgCO2e)', 'Catatan']].concat(model.detail.map(function (d) {
      var c = H.CATS.filter(function (x) { return x.key === d.cat; })[0];
      return [d.vendor, d.type === 'eks' ? 'Ekspedisi' : 'Travel agent', d.period, d.file, d.row, d.date, d.ref, d.desc, c ? 'Kat ' + c.no + (d.cat === 'cat6h' ? ' hotel' : d.cat === 'cat6t' ? ' transportasi' : '') : '', d.method, r4(d.qty), d.unit, d.fkey, d.factor == null ? '' : d.factor, d.kg == null ? '' : r4(d.kg), d.note];
    })), [28, 12, 9, 30, 10, 11, 16, 34, 16, 14, 12, 13, 22, 14, 14, 34]);
    add('Vendor', [['Vendor', 'Jenis', 'Periode', 'File', 'Baris dihitung', 'Baris ditolak', 'Tanpa jarak/faktor', 'Kat 4', 'Kat 9', 'Kat 6 transportasi', 'Kat 6 hotel', 'Total (tCO2e)', 'Masuk rentang']].concat(model.vendors.map(function (v) {
      return [v.vendor, v.type === 'eks' ? 'Ekspedisi' : 'Travel agent', v.period, v.file, v.rows, v.excluded, v.missing, r4(v.cat4), r4(v.cat9), r4(v.cat6t), r4(v.cat6h), r4(v.t), v.inRange ? 'Ya' : 'Tidak'];
    })), [28, 12, 9, 34, 13, 12, 16, 10, 10, 16, 12, 14, 13]);
    add('Faktor', [['Kunci', 'Kelompok', 'Uraian', 'Satuan', 'Faktor (kgCO2e)', 'Status', 'Sumber']].concat(model.factors.map(function (f) { return [f.key, f.group, f.id, f.unit, +f.value, f.status, f.source]; })), [26, 10, 34, 14, 14, 10, 36]);
    return wb;
  }

  root.HAPReport = { narrative: narrative, buildDocx: buildDocx, buildWorkbook: buildWorkbook, rangeLabel: rangeLabel, fyLabel: fyLabel, chartLabels: chartLabels, dataUrlBytes: dataUrlBytes, mLabel: mLabel, nID: nID };
})(typeof window !== 'undefined' ? window : globalThis);
