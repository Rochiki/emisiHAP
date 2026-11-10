# emisiHAP

Kalkulator emisi gas rumah kaca PT Hexindo Adiperkasa Tbk untuk Scope 1, 2, dan 3.
Unggah file Excel, aplikasi menghitung sendiri, lalu unduh laporan manajemen dwibahasa (Indonesia dan Inggris).

Semua proses berjalan di peramban. Data tidak dikirim ke server mana pun.

## Cara pakai

1. Buka `index.html` (lewat GitHub Pages, atau klik dua kali file-nya di komputer).
2. Unggah sekaligus:
   - laporan vendor ekspedisi (`Format_Laporan_Ekspedisi_Hexindo.xlsx` yang sudah diisi),
   - laporan travel agent (`Format_Laporan_Travel_Agent_Hexindo.xlsx` yang sudah diisi),
   - database energi Scope 1 dan 2 (workbook HAP Nasional dengan sheet `konversi emisi CO2`).
3. Periksa tahun fiskal dan rentang bulan.
4. Unduh **Laporan manajemen (Word)** dan **Kertas kerja (Excel)**.

Jenis file dikenali otomatis. Bila satu vendor mengirim dua file untuk periode yang sama, file terbaru yang dipakai.

## Yang dihitung

| Lingkup | Sumber data | Cara hitung |
|---|---|---|
| Scope 1 | Database energi (solar, bensin) | Diambil dari nilai tCO2e di database |
| Scope 2 | Database energi (listrik) | Diambil dari nilai tCO2e di database |
| Scope 3 Kat. 3 | Liter dan kWh yang sama dengan Scope 1 dan 2 | Aktivitas x faktor hulu |
| Scope 3 Kat. 4 | Laporan ekspedisi, pembayar Hexindo | BBM aktual, atau ton-km x faktor armada |
| Scope 3 Kat. 9 | Laporan ekspedisi, pembayar lain | BBM aktual, atau ton-km x faktor armada |
| Scope 3 Kat. 6 | Laporan travel agent | Jarak x faktor moda, malam hotel x faktor |

## Faktor emisi

Faktor bawaan berstatus **Ilustrasi** dan hanya pengisi awal. Ganti dengan faktor resmi di bagian
"Faktor emisi dan jarak rute", isi sumbernya, lalu ubah status menjadi Resmi. Selama masih ada faktor
ilustrasi, laporan diberi tanda DRAF.

## Menayangkan lewat GitHub Pages

Settings > Pages > Source: Deploy from a branch > Branch `main`, folder `/ (root)`.
Untuk repo private, GitHub Pages memerlukan paket GitHub berbayar. Alternatifnya, unduh repo ini sebagai ZIP
dan buka `index.html` langsung. Tombol "Coba dengan data contoh" hanya berfungsi lewat alamat web.

## Struktur

- `index.html`, `css/app.css`: halaman.
- `js/calc.js`: mesin hitung (pembaca file, rumus, model).
- `js/charts.js`, `js/report.js`: grafik, laporan Word, kertas kerja Excel.
- `js/app.js`: antarmuka.
- `vendor/`: pustaka SheetJS dan docx (disertakan agar bisa dipakai tanpa internet).
- `samples/`: file contoh. `CONTOH_SINTETIS_Database_Scope12.xlsx` berisi angka acak, bukan data Hexindo.
- `tests/`: uji otomatis mesin hitung.

## Uji otomatis

```
npm install xlsx
python3 tests/make_synthetic_s12.py /tmp/hap
node tests/run.js /tmp/hap
```
