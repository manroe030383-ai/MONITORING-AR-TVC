import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// ========================================================
// 1. KONFIGURASI UTAMA DATABASE SUPABASE AUTO2000
// ========================================================
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = { bar: null, donut: null }; 
let cachedData = []; 

// DETEKSI URL SEJAK AWAL UNTUK FILTER GLOBAL
const urlPath = window.location.pathname.toLowerCase();
const isTafsPage = urlPath.includes('tafs');
const isAccPage = urlPath.includes('acc');

// Formatter Mata Uang & Angka
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

// Helper Pengaman Nama Kolom Supabase (Mengantisipasi Spasi & Huruf Besar/Kecil)
function getProp(obj, key) {
    if (!obj) return undefined;
    if (obj[key] !== undefined) return obj[key];
    
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let k in obj) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanK === cleanKey) return obj[k];
    }
    return undefined;
}

// ========================================================
// 2. FUNGSI AMBIL DATA LIVE DARI SUPABASE
// ========================================================

async function fetchData() {
    try {
        // 1. Ambil data tanpa looping manual jika data < 5000 baris
        // Ini jauh lebih cepat dan meminimalkan beban koneksi
        const { data, error } = await supabase
            .from('ar_unit')
            .select('*'); 
            
        if (error) throw error;
        
        if (!data || data.length === 0) {
            console.warn("Data kosong atau gagal diambil.");
            return;
        }

        console.log("DATA BERHASIL DIAMBIL:", data.length);

        // 2. Gunakan data terbaru untuk perhitungan global
        // Pastikan nama kolom 'os_balance' sesuai dengan database Anda
        const totalOsGlobal = data.reduce((acc, curr) => acc + Number(curr.os_balance || 0), 0);

        // 3. Filter data berdasarkan halaman (gunakan fungsi helper)
        let finalFilteredData = filterDataByPage(data);
// --- TAMBAHAN LOGIKA SORTING (TIDAK MENGUBAH STRUKTUR LAIN) ---
        finalFilteredData.sort((a, b) => {
            const dateA = a.tgl_tagih ? new Date(a.tgl_tagih) : new Date('9999-12-31');
            const dateB = b.tgl_tagih ? new Date(b.tgl_tagih) : new Date('9999-12-31');
            return dateA - dateB;
        });
        // -------------------------------------------------------------

        // 4. Update state global
        cachedData = finalFilteredData; 
        
        // 5. Update UI
        updateDashboard(finalFilteredData, totalOsGlobal);
        updateStatusUI("SUCCESS");

    } catch (e) {
        console.error("Error Fetching Data:", e);
        updateStatusUI("ERROR", e.message);
    }
}

// Helper untuk filter agar kode lebih rapi
function filterDataByPage(data) {
    if (typeof isTafsPage !== 'undefined' && isTafsPage) {
        return data.filter(d => String(d.leasing_name || '').toUpperCase().includes('TAFS'));
    } 
    if (typeof isAccPage !== 'undefined' && isAccPage) {
        return data.filter(d => String(d.leasing_name || '').toUpperCase().includes('ACC'));
    }
    return data;
}

// Helper untuk update status UI agar tidak berantakan di dalam fetchData
function updateStatusUI(type, message = "") {
    const el = document.getElementById('status-update');
    if (!el) return;
    
    if (type === "SUCCESS") {
        el.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB (REALTIME ACTIVE)`;
        el.className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
    } else {
        el.innerText = `KONEKSI GAGAL: ${message}`;
        el.className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
    }
}
// ========================================================
// 3. FUNGSI PROSES LOGIKA & UPDATE DASHBOARD (DIPERBAIKI)
// ========================================================
function updateDashboard(data, totalGlobal) {
    // 1. Inisialisasi variabel
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let breakdown = { ACC: { total: 0, sudah: 0, belum: 0, lunas: 0 }, TAFS: { total: 0, sudah: 0, belum: 0, lunas: 0 } };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {}, mOverdueTop = [];
    let tafsMetrics = { os: 0, paid: 0, onProses: 0, overdue: 0 };
    let accMetrics = { os: 0, paid: 0, onProses: 0, overdue: 0 };
    let mLeadTime = {};

    data.forEach(d => {
        // Akses langsung kolom database
        const os = Number(d.os_balance || 0);
        s.os += os; 
        
        const b1_30 = Number(d.hari_1_30 || 0);
        const b31_60 = Number(d.hari_31_60 || 0);
        const b60 = Number(d.lebih_60_hari || 0);
        const ov = Number(d.total_overdue || 0);
        const penalti = Number(d.penalty_amount || 0);
        const lt = Number(d.lead_time || 0);
        
        const tglTagih = d.tgl_tagih;
        const tglBayar = d.tgl_bayar;
        const ketCabang = String(d.ket_cabang || '').toUpperCase().trim();
        
        // Menggunakan leasing_name sesuai database
        let l = String(d.leasing_name || 'CASH').toUpperCase().replace(/\s+/g, '').trim();
        const lancarNominal = ov === 0 ? os : (os - ov > 0 ? os - ov : 0);

        s.ov += ov; s.pen += penalti; s.lan += lancarNominal;
        if (ov > 0) { s.countOv++; mOverdueTop.push(d); }
        if (penalti > 0) s.cPen++;

        aging['LANCAR'] += lancarNominal / 1000000;
        aging['1-30 H'] += b1_30 / 1000000;
        aging['31-60 H'] += b31_60 / 1000000;
        aging['>60 H'] += b60 / 1000000;

        const isTafs = l.includes('TAFS');
        const isAcc = l.includes('ACC');

        if (l === "CASH" || l === "") { 
            s.cash += os; s.cCash++; 
        } else { 
            s.leas += os; s.cLeas++; mLeas[l] = (mLeas[l] || 0) + os; 
            if (isTafs || isAcc) {
                let target = isAcc ? breakdown.ACC : breakdown.TAFS;
                target.total++;
                if (tglBayar) target.lunas++; else if (tglTagih) target.sudah++; else target.belum++;
            }
        }
        
        if (isTafs || isAcc) {
            let m = isTafs ? tafsMetrics : accMetrics;
            if (tglBayar || os <= 0) m.paid++; 
            else { m.os += os; if (ov > 0) m.overdue++; else m.onProses++; }
        }

        if (ketCabang.includes('LUNAS') && lt > 0 && (isTafs || isAcc)) {
            if (!mLeadTime[l]) mLeadTime[l] = { total: 0, count: 0 };
            mLeadTime[l].total += lt; mLeadTime[l].count += 1;
        }
        
        const finalSales = String(d.salesman_name || "OFFICE").trim();
        const finalSpv = String(d.supervisor_name || "OFFICE").trim();
        mSales[finalSales] = (mSales[finalSales] || 0) + os;
        mSpv[finalSpv] = (mSpv[finalSpv] || 0) + os;
    });

    // 2. LOGIKA TAMPILAN DOM
    const updateCell = (id, val) => { 
        const elements = document.querySelectorAll(`[id="${id}"]`);
        elements.forEach(el => el.innerText = val);
    };

    const displayOs = (totalGlobal && totalGlobal > 0) ? totalGlobal : s.os;
    updateCell('total-os', fmtIDR(displayOs)); 
    
    updateCell('total-overdue', fmtIDR(s.ov));
    updateCell('total-penalty', fmtIDR(s.pen));
    updateCell('total-lancar', fmtIDR(s.lan));
    updateCell('val-total-cash', fmtIDR(s.cash));
    updateCell('unit-total-cash', s.cCash + " Unit");
    updateCell('val-total-leas', fmtIDR(s.leas));
    updateCell('unit-total-leas', s.cLeas + " Unit");
    
    let badgeOv = document.getElementById('badge-overdue');
    if(badgeOv) badgeOv.innerText = s.countOv + " SPK Lewat TOP";
    let spkPen = document.getElementById('spk-penalty');
    if(spkPen) spkPen.innerText = s.cPen + " SPK";

    updateCell('tafs-outstanding', fmtIDR(tafsMetrics.os));
    updateCell('tafs-paid', tafsMetrics.paid + " Unit");
    updateCell('tafs-on-proses', tafsMetrics.onProses + " Unit");
    updateCell('tafs-overdue', tafsMetrics.overdue + " Unit");

    updateCell('acc-outstanding', fmtIDR(accMetrics.os));
    updateCell('acc-paid', accMetrics.paid + " Unit");
    updateCell('acc-on-proses', accMetrics.onProses + " Unit");
    updateCell('acc-overdue', accMetrics.overdue + " Unit");

    ['ACC', 'TAFS'].forEach(l => {
        let avg = (mLeadTime[l] && mLeadTime[l].count > 0) ? Math.round(mLeadTime[l].total / mLeadTime[l].count) : 0;
        updateCell(`val-lead-time-${l.toLowerCase()}`, avg + " Hari");
        let bar = document.getElementById(`bar-lead-time-${l.toLowerCase()}`);
        if (bar) bar.style.width = Math.min(avg, 100) + "%";
    });

    updateCell('total-do-acc', breakdown.ACC.total);
    updateCell('total-do-tafs', breakdown.TAFS.total);
    updateCell('sudah-tagih-acc', breakdown.ACC.sudah);
    updateCell('sudah-tagih-tafs', breakdown.TAFS.sudah);
    updateCell('belum-tagih-acc', breakdown.ACC.belum);
    updateCell('belum-tagih-tafs', breakdown.TAFS.belum);
    updateCell('lunas-acc', breakdown.ACC.lunas);
    updateCell('lunas-tafs', breakdown.TAFS.lunas);

    let totalOsInternal = s.os > 0 ? s.os : 1;
    let pctCash = (s.cash / totalOsInternal) * 100;
    let pctLeas = (s.leas / totalOsInternal) * 100;
    
    let elBarCash = document.getElementById('bar-cash');
    let elBarLeas = document.getElementById('bar-leasing');
    if (elBarCash) elBarCash.style.width = pctCash + "%";
    if (elBarLeas) elBarLeas.style.width = pctLeas + "%";

    ['ACC', 'TAFS'].forEach(l => {
        let avg = (mLeadTime[l] && mLeadTime[l].count > 0) ? Math.round(mLeadTime[l].total / mLeadTime[l].count) : 0;
        updateCell(`avg-lead-${l.toLowerCase()}`, avg + " Hari");
        let bar = document.getElementById(`bar-${l.toLowerCase()}`);
        if (bar) {
            bar.style.width = Math.min(avg, 100) + "%";
            bar.style.backgroundColor = (l === 'ACC') ? '#EF4444' : '#3B82F6';
        }
    });

    renderAgingChart(aging);
    renderDonutLeasing(mLeas);
    renderLeasingList(mLeas, displayOs);
    renderTopList(mSales, 'list-sales', 'text-blue-600');
    renderTopList(mSpv, 'list-spv', 'text-purple-600');
    renderOverdueTop(mOverdueTop);
    renderTabLeasingFull(data);
    renderTabOverdueFull(data);
    renderTabDatabaseFull(data);
    
    if (typeof renderDataArUnitFull === 'function') {
        renderDataArUnitFull(data);
    }
}

 // ========================================================
// 4. FUNGSI RENDER VISUAL GRAFIK & DIAGRAM (APEXCHARTS)
// ========================================================
function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging");
    if (!el) return;
    const options = {
        series: [{ name: 'Juta', data: Object.values(agingData).map(v => Math.round(v)) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: (v) => v + " Jt", style: { fontSize: '9px', fontWeight: 800 }, offsetY: -20 },
        xaxis: { categories: Object.keys(agingData), labels: { style: { fontSize: '9px', fontWeight: 700 } } },
        yaxis: { show: false },
        grid: { show: false },
        legend: { show: false }
    };
    if (charts.bar) charts.bar.updateOptions(options);
    else { charts.bar = new ApexCharts(el, options); charts.bar.render(); }
}

// ========================================================
// 5. SINKRONISASI INTERAKTIF JANGKAR ID INPUT BERBASIS SPK
// ========================================================
function renderDataArUnitFull(data) {
    const el = document.getElementById('tab-ar-unit-body');
    if (!el) return;

    const dataTampil = data.filter(d => {
        const ket = String(d.ket_cabang || '').toUpperCase().trim();
        return !ket.includes('LUNAS'); 
    });

    if(dataTampil.length === 0) { 
        const namaHalaman = isTafsPage ? 'TAFS' : (isAccPage ? 'ACC' : 'TAFS / ACC');
        el.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400 font-bold">Tidak ada unit aktif dengan Leasing ${namaHalaman}</td></tr>`; 
        return; 
    }

    const isLeasingView = isTafsPage || isAccPage;

    el.innerHTML = dataTampil.map((d, i) => {
        const spkAsli = String(getProp(d, 'No SPK') || getProp(d, 'no_spk') || '').trim();
        const idSistem = spkAsli.replace(/[^a-zA-Z0-9]/g, '_');
        const noCustomer = getProp(d, 'no_customer') || '-';
        
        const valKetCabang = d['ket_cabang'] || '';
        const valPlanBayar = d['plan_bayar_leasing'] || '';
        const valKetLeasing = d['ket_leasing'] || '';

        return `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4">
                <p class="text-slate-800 font-black text-[11px]">${getProp(d, 'Customer Name') || getProp(d, 'customer_name') || '-'}</p>
                <p class="text-[10px] text-slate-400 font-medium normal-case mt-0.5">${noCustomer}</p>
            </td>
            <td class="p-4">
                <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded text-[9px] font-extrabold tracking-wide">${getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || '-'}</span>
                <p class="text-[7px] text-slate-400 mt-1">SPK: ${spkAsli}</p>
            </td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(getProp(d, 'O/S Balance') || getProp(d, 'os_balance'))}</td>
            
            <td class="p-4 w-48">
                ${isLeasingView ? 
                    `<input type="text" value="${valKetCabang}" placeholder="Ket cabang..." 
                     class="input-custom bg-slate-100 text-slate-500 cursor-not-allowed border-none shadow-none" readonly>` : 
                    `<input type="text" id="cabang-${idSistem}" value="${valKetCabang}" placeholder="Ket cabang..." 
                     class="input-custom bg-white">`
                }
            </td>
            
            <td class="p-4 w-48">
                <input type="text" id="plan-${idSistem}" value="${valPlanBayar}" placeholder="${isLeasingView ? 'Isi plan bayar...' : 'Menunggu isian leasing...'}" 
                class="input-custom ${isLeasingView ? 'bg-white border-emerald-300' : 'bg-slate-50 text-slate-500 cursor-not-allowed'}" 
                ${isLeasingView ? '' : 'readonly'}>
            </td>
            
            <td class="p-4 w-48">
                <input type="text" id="ket-${idSistem}" value="${valKetLeasing}" placeholder="${isLeasingView ? 'Isi ket leasing...' : 'Menunggu keterangan leasing...'}" 
                class="input-custom ${isLeasingView ? 'bg-white border-emerald-300' : 'bg-slate-50 text-slate-500 cursor-not-allowed'}" 
                ${isLeasingView ? '' : 'readonly'}>
            </td>
            
            <td class="p-4 text-center w-16">
                ${isLeasingView ? 
                    `<button onclick="simpanCatatanLeasing('${spkAsli}')" class="text-emerald-600 hover:bg-emerald-600 hover:text-white bg-emerald-50 p-2 rounded-lg transition-all" title="Simpan Respon Leasing">💾</button>` :
                    `<button onclick="simpanCatatan('${spkAsli}')" class="text-blue-600 hover:bg-blue-600 hover:text-white bg-blue-50 p-2 rounded-lg transition-all" title="Simpan Catatan Cabang">💾</button>`
                }
            </td>
        </tr>`;
    }).join('');
}


function renderDonutLeasing(mLeas) {
    const el = document.querySelector("#chart-donut-leasing");
    if (!el) return;
    let totalCash = 0; let totalLeasing = 0;
    cachedData.forEach(d => {
        const os = Number(getProp(d, 'O/S Balance') || getProp(d, 'os_balance') || 0);
        const l = String(getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || getProp(d, 'leasing_name') || 'CASH').toUpperCase().trim();
        if (["CASH", "CASH TERIMA", "", "-"].includes(l)) { totalCash += os; } else { totalLeasing += os; }
    });
    const seriesDonut = [totalCash, totalLeasing]; const labelsDonut = ['TOTAL CASH', 'TOTAL LEASING'];
    const options = {
        series: (totalCash === 0 && totalLeasing === 0) ? [1, 1] : seriesDonut, labels: labelsDonut,
        chart: { type: 'donut', height: 180 }, legend: { show: false }, dataLabels: { enabled: false },
        colors: ['#10B981', '#3B82F6'], plotOptions: { pie: { donut: { labels: { show: false } } } }
    };
    if (charts.donut) charts.donut.updateOptions(options); else { charts.donut = new ApexCharts(el, options); charts.donut.render(); }
}

function renderLeasingList(map, total) {
    const el = document.getElementById('leasing-list'); if (!el) return;
    if (Object.keys(map).length === 0) { el.innerHTML = '<p class="text-[10px] text-slate-400">Tidak ada data leasing</p>'; return; }
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n, v]) => `
        <div class="mb-3">
            <div class="flex justify-between text-[9px] font-bold mb-1 uppercase"><span>${n}</span><span>${total > 0 ? ((v/total)*100).toFixed(1) : 0}%</span></div>
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div class="bg-blue-600 h-full" style="width: ${total > 0 ? (v/total)*100 : 0}%"></div></div>
        </div>`).join('');
}

function renderTopList(map, id, colorClass) {
    const el = document.getElementById(id); if (!el) return;
    if (Object.keys(map).length === 0) { el.innerHTML = '<p class="text-[10px] text-slate-400 text-center py-2">Tidak ada data</p>'; return; }
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map((x,i) => `
        <div class="flex justify-between items-center py-3 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${x[0]}</span>
            <span class="text-[10px] ${colorClass}">${fmtJuta(x[1])}</span>
        </div>`).join('');
}

function renderOverdueTop(data) {
    const el = document.getElementById('list-overdue'); if (!el) return;
    if (data.length === 0) { el.innerHTML = '<p class="text-[10px] text-slate-400 text-center py-2">Tidak ada data overdue</p>'; return; }
    const sortedData = [...data].sort((a, b) => {
        const osA = Number(getProp(a, 'Hari 1-30') || 0) + Number(getProp(a, 'Hari 31-60') || 0) + Number(getProp(a, 'Lebih 60 Hari') || 0);
        const osB = Number(getProp(b, 'Hari 1-30') || 0) + Number(getProp(b, 'Hari 31-60') || 0) + Number(getProp(b, 'Lebih 60 Hari') || 0);
        return osB - osA;
    });
    el.innerHTML = sortedData.slice(0,5).map((d,i) => {
        const totalOverdueItem = Number(getProp(d, 'Hari 1-30') || 0) + Number(getProp(d, 'Hari 31-60') || 0) + Number(getProp(d, 'Lebih 60 Hari') || 0);
        return `
        <div class="flex justify-between py-2 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${getProp(d, 'Customer Name') || getProp(d, 'customer_name') || '-'}</span>
            <span class="text-[10px] text-red-500">${fmtJuta(totalOverdueItem)}</span>
        </div>`;
    }).join('');
}

function borderTrClass(i) { return 'hover:bg-slate-50/80 transition-all font-bold uppercase'; }

// ========================================================
// RE-RENDER FULL LIST LOGIC
// ========================================================
function renderTabLeasingFull(data) {
    const el = document.getElementById('tab-leasing-full-list'); if (!el) return;
    data = data.filter(d => {
        const leasing = String(getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || '').toUpperCase().trim();
        const os = Number(getProp(d, 'O/S Balance') || getProp(d, 'os_balance') || 0);
        return os > 0 && !['CASH', 'CASH TERIMA', '', '-'].includes(leasing);
    });
    if(data.length === 0) { el.innerHTML = '<p class="text-xs text-center py-4 text-slate-400">Tidak ada data kontribusi leasing</p>'; return; }
    el.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[10px]">
                <thead>
                    <tr class="border-b border-slate-100 text-slate-400 font-bold bg-slate-50 uppercase">
                        <th class="p-3 w-12 text-center">No</th>
                        <th class="p-3">Nama Customer / Sales</th>
                        <th class="p-3">Nama Leasing</th>
                        <th class="p-3 text-right pr-6">O/S Balance</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                    ${data.map((d, i) => `
                        <tr class="${borderTrClass(i)}">
                            <td class="p-3 text-center text-slate-400">${i+1}</td>
                            <td class="p-3">
                                <p class="text-slate-800 text-[11px] font-black">${getProp(d, 'Customer Name') || getProp(d, 'customer_name') || '-'}</p>
                                <p class="text-[8px] text-slate-400 mt-0.5">👤 SALES: ${getProp(d, 'Salesman Name') || getProp(d, 'salesman_name') || 'OFFICE'}</p>
                            </td>
                            <td class="p-3">
                                <span class="bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-[9px] font-extrabold tracking-wide">${getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || '-'}</span>
                            </td>
                            <td class="p-3 text-right pr-6 text-blue-600 text-[11px] font-black">${fmtIDR(getProp(d, 'O/S Balance') || getProp(d, 'os_balance'))}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

function renderTabOverdueFull(data) {
    const el = document.getElementById('tab-overdue-full-list'); if (!el) return;
    const overdueData = data.filter(d => (Number(getProp(d, 'Hari 1-30') || 0) + Number(getProp(d, 'Hari 31-60') || 0) + Number(getProp(d, 'Lebih 60 Hari') || 0)) > 0);
    if(overdueData.length === 0) { el.innerHTML = '<p class="text-xs text-center py-4 text-slate-400">Semua tagihan lunas / tidak ada overdue</p>'; return; }
    el.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[10px]">
                <thead>
                    <tr class="border-b border-slate-100 text-slate-400 font-bold bg-slate-50 uppercase">
                        <th class="p-3 w-12 text-center">No</th>
                        <th class="p-3">Nama Customer</th>
                        <th class="p-3">Leasing</th>
                        <th class="p-3 text-right text-red-500 bg-red-50/50">Total Overdue</th>
                        <th class="p-3 text-right pr-6">O/S Balance</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                    ${overdueData.map((d, i) => {
                        const totalOvItem = Number(getProp(d, 'Hari 1-30') || 0) + Number(getProp(d, 'Hari 31-60') || 0) + Number(getProp(d, 'Lebih 60 Hari') || 0);
                        return `
                        <tr class="${borderTrClass(i)}">
                            <td class="p-3 text-center text-slate-400">${i+1}</td>
                            <td class="p-3">
                                <p class="text-slate-800 text-[11px] font-black">${getProp(d, 'Customer Name') || getProp(d, 'customer_name') || '-'}</p>
                                <p class="text-[8px] text-slate-400 mt-0.5">👤 SALES: ${getProp(d, 'Salesman Name') || getProp(d, 'salesman_name') || 'OFFICE'}</p>
                            </td>
                            <td class="p-3">
                                <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">${getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || 'CASH'}</span>
                            </td>
                            <td class="p-3 text-right font-black text-red-600 bg-red-50/20">${fmtIDR(totalOvItem)}</td>
                            <td class="p-3 text-right pr-6 text-blue-600 text-[11px] font-bold">${fmtIDR(getProp(d, 'O/S Balance') || getProp(d, 'os_balance'))}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

function renderTabDatabaseFull(data) {
    const el = document.getElementById('tab-database-body'); if (!el) return;
    el.innerHTML = data.map((d, i) => {
        const os = Number(getProp(d, 'O/S Balance') || 0);
        const b1 = Number(getProp(d, 'Hari 1-30') || 0); const b2 = Number(getProp(d, 'Hari 31-60') || 0); const b3 = Number(getProp(d, 'Lebih 60 Hari') || 0);
        const totalOv = b1 + b2 + b3; const lancar = totalOv === 0 ? os : (os - totalOv > 0 ? os - totalOv : 0);
        return `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4 text-slate-800 font-black">${getProp(d, 'Customer Name') || getProp(d, 'customer_name') || '-'}</td>
            <td class="p-4"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">${getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || 'CASH'}</span></td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(os)}</td>
            <td class="p-4 text-right text-emerald-600">${fmtIDR(lancar)}</td>
            <td class="p-4 text-right text-amber-500">${fmtIDR(b1)}</td>
            <td class="p-4 text-right text-orange-500">${fmtIDR(b2)}</td>
            <td class="p-4 text-right text-red-500">${fmtIDR(b3)}</td>
            <td class="p-4 text-right text-red-600 font-black bg-red-50/30">${fmtIDR(totalOv)}</td>
        </tr>`;
    }).join('');
}

// ========================================================
// 6. FUNGSI SIMPAN KHUSUS ADMIN CABANG (DASHBOARD.HTML) - FIXED DATA SYNC
// ========================================================
window.simpanCatatanCabang = async function(nomorSPK) {
    try {
        if (!nomorSPK) return;
        const idSistem = nomorSPK.replace(/[^a-zA-Z0-9]/g, '_');
        const inputEl = document.getElementById(`cabang-${idSistem}`);
        if (!inputEl) return;
        
        const { error } = await supabase
            .from('ar_unit')
            .update({ ket_cabang: inputEl.value })
            .eq('no_spk', nomorSPK);

        if (error) throw error;
        alert("Keterangan cabang berhasil disimpan! 👍");
        fetchData();
    } catch (err) {
        console.error(err);
        alert("Gagal menyimpan: " + err.message);
    }
}
// ========================================================
// 7. FUNGSI SIMPAN KHUSUS LEASING (TAFS.HTML / ACC.HTML) - FIXED DATA SYNC
// ========================================================
window.simpanCatatanLeasing = async function(nomorSPK) {
    try {
        if (!nomorSPK) return;
        const idSistem = String(nomorSPK).replace(/[^a-zA-Z0-9]/g, '_');
        
        // Sesuaikan ID yang dicari dengan elemen di TAFS.html/ACC.html
        const elPlan = document.getElementById(`plan-${idSistem}`);
        const elKet = document.getElementById(`ket-${idSistem}`);
        
        const { error } = await supabase
            .from('ar_unit')
            .update({ 
                plan_bayar_leasing: elPlan ? elPlan.value : null,
                ket_leasing: elKet ? elKet.value : null 
            })
            .eq('no_spk', nomorSPK);

        if (error) throw error;
        alert("Respon leasing berhasil disimpan! 👍");
        fetchData();
    } catch (err) {
        console.error(err);
        alert("Gagal menyimpan: " + err.message);
    }
}
// ========================================================
// 8. FUNGSI DOWNLOAD DATA KE EXCEL (FIXED FOR COMPATIBILITY)
// ========================================================
function downloadExcel() {
    if (!cachedData || cachedData.length === 0) { alert("Data belum siap."); return; }
    try {
        const dataUntukExcel = cachedData.map((d, index) => {
            const os = Number(getProp(d, 'O/S Balance') || 0);
            const b1 = Number(getProp(d, 'Hari 1-30') || 0); const b2 = Number(getProp(d, 'Hari 31-60') || 0); const b3 = Number(getProp(d, 'Lebih 60 Hari') || 0);
            const totalOv = b1 + b2 + b3; const lancar = totalOv === 0 ? os : (os - totalOv > 0 ? os - totalOv : 0);
            return {
                "No": index + 1, "Nama Customer": getProp(d, 'Customer Name') || "-", "No SPK": getProp(d, 'No SPK') || "-",
                "Leasing": getProp(d, 'Chas/Leasing') || "CASH", "O/S Balance": os, "Hari 1-30 (Lancar)": lancar,
                "Hari 31-60": b1, "Lebih 60 Hari": b2, "Total Overdue": totalOv, "Potensi Penalti": getProp(d, 'Potensi Penalti') || 0,
                "Salesman": getProp(d, 'Salesman Name') || "-", "Supervisor": getProp(d, 'Supervisor') || "-",
                "Keterangan Cabang": d['ket_cabang'] || "", 
                "Plan Bayar Leasing": d['plan_bayar_leasing'] || "", "Keterangan Leasing": d['ket_leasing'] || ""
            };
        });
        const worksheet = XLSX.utils.json_to_sheet(dataUntukExcel); const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data AR Unit");
        
        const namaFile = isTafsPage ? 'TAFS' : (isAccPage ? 'ACC' : 'All');
        XLSX.writeFile(workbook, `Report_AR_Unit_${namaFile}_Auto2000_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) { console.error(error); }
}

// ========================================================
// 9. FUNGSI RENDER UI LEAD TIME (TAMBAHAN)
// ========================================================
window.updateLeadTimeUI = function(dataArray) {
    const container = document.getElementById('list-avg-leasing');
    if (!container) return;
    
    if (dataArray.length === 0) {
        container.innerHTML = '<p class="text-[9px] text-slate-400 italic text-center">Belum ada data unit lunas.</p>';
        return;
    }

    container.innerHTML = dataArray.map(item => `
        <div class="text-[10px] font-bold">
            <div class="flex justify-between mb-1">
                <span class="text-slate-600">${item.leasing}</span>
                <span class="text-[#1B2559]">${item.avg} Hari</span>
            </div>
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                <div class="bg-blue-500 h-1 rounded-full" style="width: ${Math.min((item.avg/30)*100, 100)}%"></div>
            </div>
        </div>
    `).join('');
};



// 10. INISIALISASI REALTIME LISTENER & EVENT HANDLER
document.addEventListener('DOMContentLoaded', () => {
    const btnDownload = document.getElementById('btn-download-excel');
    if (btnDownload) { btnDownload.addEventListener('click', downloadExcel); }    
    
    // Ambil data pertama kali saat dashboard dibuka
    fetchData();

    // Inisialisasi timer untuk debounce
    let debounceTimer;
    
    // ========================================================
    // AKTIFKAN LIVE SYNC REAL-TIME SUPABASE 
    // ========================================================
    supabase
        .channel('schema-db-changes')
        .on(
            'postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'ar_unit' 
            }, 
            (payload) => {
                console.log('Perubahan Database Terdeteksi, menjalankan debounce...');
                
                // Hapus timer sebelumnya dan mulai timer baru
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    console.log('Refreshing data setelah debounce...');
                    fetchData(); 
                }, 800); 
            }
        )
        .subscribe((status) => {
            console.log('Status Sinkronisasi Live Realtime:', status);
        });
});