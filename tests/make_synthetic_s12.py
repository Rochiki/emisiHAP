"""Membuat workbook SINTETIS yang meniru tata letak database energi HAP Nasional, untuk uji otomatis.
Angka di dalamnya acak dan BUKAN data Hexindo."""
import json, random, sys
from openpyxl import Workbook
from openpyxl.utils import get_column_letter as L

random.seed(7)
BR = ['Bandung','Jakarta','Medan','Padang','Palembang','Pontianak','Balikpapan','Banjarmasin','Jayapura','Makassar','Manado','Samarinda','Sampit','Surabaya','Tarakan']
CO = ['Bandar Lampung','Batu Licin','Cilegon','GAM Site Support','Gorontalo','Kendari','Ketapang','Kupang','Merauke','Muara Enim','Morowali','Palu','Pangkal Pinang','Semarang','Sorong','Sungai Baung','Tanjung Pandan','Weda']
MS = ['Adaro BUMA','Adaro SIS','Balikpapan Mining','Bengalon','Berau','Kideco PAMA & SIMS','Malinau','Melak','Muara Bungo ATP','Muara Teweh','Pani Gold','Samarinda Mining','Sangatta','Sorowako Vale','Sumbawa AMNT','Toka Tidung','Wetar','Balikpapan Remanufacturing','Balikpapan TC','Samarinda Welding','Sangatta Welding']
EXTRA = ['Jambi','Pekanbaru','Aceh']          # ada di sheet konversi, tidak ada di Analisa
CAT = {**{n:'Branch ' for n in BR}, **{n:'Contact Office' for n in CO}, **{n:'Mining Support/Project' for n in MS}}
KONV = BR + EXTRA + CO + MS                    # 57 lokasi
MONTHS = [4,5,6,7,8,9,10,11,12,1,2,3]
FILLED = 7                                     # April s.d. Oktober terisi
FS, FB = 0.00262, 0.00229
GRID = [0.00087,0.00076,0.00092,0.00081,0.00085]

def build(variant, path):
    act, em = {}, {}
    for n in KONV:
        big = 40 if n in MS else (25 if n == 'Jakarta' else 4)
        fe = random.choice(GRID)
        for i, m in enumerate(MONTHS):
            if i < FILLED:
                s, b, k, w = random.uniform(50, 900)*big/4, random.uniform(20, 400)*big/6, random.uniform(300, 9000)*big/4, random.uniform(0, 80)
            else:
                s = b = k = w = 0
            act[(n, m)] = (s, b, k, w)
            em[(n, m)] = (s*FS, b*FB, k*fe, 0.0)
    wb = Workbook()
    a = wb.active; a.title = 'Analisa'
    a['B1'] = 'DATA BASE PENGGUNAAN ENERGI HAP NASIONAL'; a['B2'] = 'SCOPE 1 DAN SCOPE 2'
    a['B4'], a['C4'], a['D4'] = 'No', 'Kategori', 'Lokasi Area'
    heads = ['Emisi CO2e April','May','June','July','August','Sept','October','Nov','Dec','January','February','March']
    for i, h in enumerate(heads):
        c = 5 + 3*i
        a.cell(row=4, column=c, value=h)
        for j, sub in enumerate(['Solar (' if i == 0 else 'Solar (L)', 'Bensin(L)', 'Listrik (Kwh)']):
            a.cell(row=5, column=c+j, value=sub)
    last = None
    for r, n in enumerate(BR + CO + MS, start=6):
        a.cell(row=r, column=2, value=r-5)
        if CAT[n] != last:
            a.cell(row=r, column=3, value=CAT[n]); last = CAT[n]
        a.cell(row=r, column=4, value=n)
        for i, m in enumerate(MONTHS):
            if i < FILLED:
                for j in range(3):
                    a.cell(row=r, column=5+3*i+j, value=em[(n, m)][j])

    inp = wb.create_sheet('Input data')
    if variant == 'a':
        inp['A1'] = 'INPUT DATA PENGGUNAAN ENERGI'
        inp['A3'], inp['B3'] = 'No', 'Lokasi Area'
        ih = ['April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember','Januari','Februari','Maret']
        for i, h in enumerate(ih):
            inp.cell(row=3, column=3+4*i, value=h)
            for j, sub in enumerate(['Solar (L)','Bensin (L)','Listrik (kWh)','Air (m3)']):
                inp.cell(row=4, column=3+4*i+j, value=sub)
        for r, n in enumerate(KONV, start=5):
            inp.cell(row=r, column=1, value=r-4); inp.cell(row=r, column=2, value=n)
            for i, m in enumerate(MONTHS):
                if i < FILLED:
                    for j in range(4):
                        inp.cell(row=r, column=3+4*i+j, value=act[(n, m)][j])
    else:
        inp['A1'] = 'Catatan pengisian'; inp['A2'] = 'Isi data paling lambat tanggal 15'; inp['A4'] = 'PIC'; inp['B4'] = 'Email'

    md = wb.create_sheet('Master_Data')
    for c, h in enumerate(['Bulan','Kategori','Lokasi','Energi','Faktor Emisi','Scope','Unit'], start=1):
        md.cell(row=1, column=c, value=h)
    for r, row in enumerate([('Januari','Branch','Bandung','Solar',FS,'Scope 1','Liter'),('Februari','Contact Office','Jakarta','Bensin',FB,'Scope 1','Liter'),('Maret','Mining Support','Medan','Listrik',0.00087,'Scope 2','kWh'),('April',None,'Padang','Air',0.5,'Scope 3','kg CO2e / m3')], start=2):
        for c, v in enumerate(row, start=1):
            md.cell(row=r, column=c, value=v)

    k = wb.create_sheet('konversi emisi CO2')
    k['B1'] = 'DATA KONVERSI JEJAK KARBON HAP NASIONAL'; k['G1'], k['H1'], k['I1'], k['J1'], k['K1'] = 'Solar', FS, 'Bensin', FB, 'LISTRIK AREA'
    k['B2'] = 'SCOPE 1 DAN SCOPE 2'; k['G2'], k['H2'], k['I2'], k['J2'] = 'Listrik', 0.00082, 'Air', 0
    for i, f in enumerate(GRID):
        k.cell(row=2, column=11+i, value=i+1); k.cell(row=3, column=11+i, value=f)
    k['B5'], k['C5'], k['D5'], k['D6'] = 'No', 'Lokasi Area', 'Link ', 'Pendukung'
    kh = ['April','Mei','Juni ','Jul','Agustus','Sept','Oktober','Nov','Des','Januari','Februari','Maret']
    subs = ['Solar (tCO2e)','Bensin (tCO2e)','Listrik (tCO2e)','Air (tCO2e)']
    for i, h in enumerate(kh):
        k.cell(row=5, column=5+4*i, value=h)
        for j, s in enumerate(subs):
            k.cell(row=6, column=5+4*i+j, value=s)
    k.cell(row=5, column=53, value='Total')
    for j, s in enumerate(subs):
        k.cell(row=6, column=53+j, value=s)
    for r, n in enumerate(KONV, start=7):
        k.cell(row=r, column=2, value=r-6); k.cell(row=r, column=3, value=n + (' ' if r % 9 == 0 else ''))
        tot = [0, 0, 0, 0]
        for i, m in enumerate(MONTHS):
            for j in range(4):
                v = em[(n, m)][j]
                k.cell(row=r, column=5+4*i+j, value=v); tot[j] += v
        for j in range(4):
            k.cell(row=r, column=53+j, value=tot[j])
    k.cell(row=7, column=5+4*8, value='#REF!')          # sel error di bulan kosong (Des)
    k.cell(row=64, column=3, value='TOTAL')
    for c in range(5, 57):
        k.cell(row=64, column=c, value=999999)
    k.cell(row=70, column=3, value='Lokasi Area'); k.cell(row=70, column=5, value='April'); k.cell(row=71, column=5, value='Solar (tCO2e)')
    k.cell(row=72, column=3, value='Bandung'); k.cell(row=72, column=5, value=123456)

    wb.create_sheet('Konversi')['A1'] = 'tabel bantu'
    s1 = wb.create_sheet('Sheet1'); s1['A3'], s1['B3'] = 'x', 1

    if variant in ('a', 'b'):
        d = wb.create_sheet('Dashboard')
        d['A1'] = 'MONITORING EMISI KARBON NASIONAL (BULANAN & TAHUNAN)'; d['A3'] = 'RINGKASAN TOTAL TAHUNAN'; d['B4'] = '#REF!'
        for c, h in {1:'Bulan',2:'Solar (tCO2)',3:'Bensin (tCO2)',4:'Listrik (tCO2)',5:'Total Bulanan',9:'Bulan',17:'co2',18:'liter\n (Solar)',19:'gigajoule\n (Solar)',20:'liter (Bensin)',21:'GJ (Bensin)',22:'KWH (Listrik)',23:'GJ (Listrik)'}.items():
            d.cell(row=10, column=c, value=h)
        dn = ['April','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','March']
        for i, m in enumerate(MONTHS):
            r = 11 + i
            d.cell(row=r, column=1, value=dn[i]); d.cell(row=r, column=9, value=dn[i][:3])
            S = sum(act[(n, m)][0] for n in KONV); B = sum(act[(n, m)][1] for n in KONV); K = sum(act[(n, m)][2] for n in KONV)
            d.cell(row=r, column=2, value=S*FS); d.cell(row=r, column=3, value=B*FB)
            d.cell(row=r, column=17, value='#DIV/0!' if i >= FILLED else 0.0526)
            d.cell(row=r, column=18, value=S); d.cell(row=r, column=19, value=S*0.036); d.cell(row=r, column=20, value=B); d.cell(row=r, column=21, value=B*0.033); d.cell(row=r, column=22, value=K); d.cell(row=r, column=23, value=K*0.0036)
    wb.save(path)
    exp = {'months': {}, 'locations': len(KONV)}
    for i, m in enumerate(MONTHS):
        y = 2026 if m >= 4 else 2027
        exp['months']['%d-%02d' % (y, m)] = {
            's1': sum(em[(n, m)][0] + em[(n, m)][1] for n in KONV), 's2': sum(em[(n, m)][2] for n in KONV),
            'solarL': sum(act[(n, m)][0] for n in KONV), 'bensinL': sum(act[(n, m)][1] for n in KONV), 'kwh': sum(act[(n, m)][2] for n in KONV),
            'solarE': sum(em[(n, m)][0] for n in KONV), 'bensinE': sum(em[(n, m)][1] for n in KONV)}
    exp['seg'] = {}
    for n in KONV:
        seg = 'ho' if n == 'Jakarta' else 'bpn' if n.startswith('Balikpapan') else 'branch' if n in BR else 'mining' if n in MS else 'co'
        exp['seg'][seg] = exp['seg'].get(seg, 0) + sum(sum(em[(n, m)][:3]) for m in MONTHS)
    return exp

if __name__ == '__main__':
    out = sys.argv[1]
    res = {}
    for v in ('a', 'b', 'c'):
        random.seed(7)
        res[v] = build(v, '%s/s12_%s.xlsx' % (out, v))
    json.dump(res, open(out + '/expected.json', 'w'))
    print('ok')
