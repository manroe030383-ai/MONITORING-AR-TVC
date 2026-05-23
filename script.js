import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// ========================================================
// 1. KONFIGURASI UTAMA DATABASE SUPABASE AUTO2000
// ========================================================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let cachedData = []; 

// Formatter Mata Uang & Angka
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

// Helper Pengaman Nama Kolom Supabase
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
        let query = supabase.from('ar_unit').select('*');
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
            console.log("DATA TERBARU DARI SUPABASE:", data); 
            cachedData = data; 
            updateDashboard(data);
            
            if (document.getElementById('status-update')) {
                document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
                document.getElementById('status-update').className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
            }
        }
    } catch (e) {
        console.error("Error Fetching:", e);
    }
}

// ========================================================
// 3. FUNGSI PROSES LOGIKA DATA & HITUNG METRIK DASHBOARD
// ========================================================
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {}, mOverdueTop = [];

    let tafsMetrics = { os: 0, paid: 0, onProses: 0, overdue: 0 };
    let accMetrics = { os: 0, paid: 0, onProses: 0, overdue: 0 };

    data.forEach(d => {
        const os = Number(getProp(d, 'O/S Balance') || getProp(d, 'os_balance') || 0);
        const b1_30 = Number(getProp(d, 'Hari 1-30') || getProp(d, 'hari_1_30') || 0);
        const b31_60 = Number(getProp(d, 'Hari 31-60') || getProp(d, 'hari_31_60') || 0);
        const b60 = Number(getProp(d, 'Lebih 60 Hari') || getProp(d, 'lebih_60_hari') || 0);
        
        const ov = (getProp(d, 'Total Overdue') !== undefined) ? Number(getProp(d, 'Total Overdue')) : (b1_30 + b31_60 + b60);
        const l = String(getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || getProp(d, 'leasing_name') || 'CASH').toUpperCase().trim();
        const penalti = Number(getProp(d, 'Potensi Penalti') || getProp(d, 'penalty_amount') || 0);
        const statusTagih = String(getProp(d, 'status_tagih') || getProp(d, 'Status Tagih') || '').toUpperCase().trim();
        
        const lancarNominal = ov === 0 ? os : (os - ov > 0 ? os - ov : 0);

        s.os += os; 
        s.ov += ov; 
        s.pen += penalti; 
        s.lan += lancarNominal;
        
        if (ov > 0) { s.countOv++; mOverdueTop.push(d); }
        if (penalti > 0) s.cPen++;

        aging['LANCAR'] += lancarNominal / 1000000;
        aging['1-30 H'] += b1_30 / 1000000;
        aging['31-60 H'] += b31_60 / 1000000;
        aging['>60 H'] += b60 / 1000000;

        if (["CASH", "CASH TERIMA", "", "-"].includes(l)) { 
            s.cash += os; s.cCash++; 
        } else { 
            s.leas += os; s.cLeas++; 
            mLeas[l] = (mLeas[l] || 0) + os; 
            
            if (l.includes('TAFS') || l.includes('ACC')) {
                tvc.total++;
                if (statusTagih === 'SUDAH GI') tvc.gi++;
                else tvc.deliv++;
            }
        }

        if (l.includes('TAFS')) {
            if (statusTagih === 'SUDAH GI' || os === 0) tafsMetrics.paid++;
            else { tafsMetrics.os += os; if (ov > 0) tafsMetrics.overdue++; else tafsMetrics.onProses++; }
        } 
        else if (l.includes('ACC')) {
            if (statusTagih === 'SUDAH GI' || os === 0) accMetrics.paid++;
            else { accMetrics.os += os; if (ov > 0) accMetrics.overdue++; else accMetrics.onProses++; }
        }

        const rawSales = String(getProp(d, 'Salesman Name') || getProp(d, 'salesman_name') || "").trim();
        const rawSpv = String(getProp(d, 'Supervisor') || getProp(d, 'supervisor_name') || "").trim();
        mSales[rawSales !== "" ? rawSales : "OFFICE"] = (mSales[rawSales !== "" ? rawSales : "OFFICE"] || 0) + os;
        mSpv[rawSpv !== "" ? rawSpv : "OFFICE"] = (mSpv[rawSpv !== "" ? rawSpv : "OFFICE"] || 0) + os;
    });

    // Pasang nilai ke elemen UI Dashboard jika eksis
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    if(document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    if(document.getElementById('badge-overdue')) document.getElementById('badge-overdue').innerText = `${s.countOv} SPK LEWAT TOP`;
    
    if(document.getElementById('val-total-cash')) document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    if(document.getElementById('unit-total-cash')) document.getElementById('unit-total-cash').innerText = `${s.cCash} Unit`;
    if(document.getElementById('val-total-leas')) document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    if(document.getElementById('unit-total-leas')) document.getElementById('unit-total-leas').innerText = `${s.cLeas} Unit`;

    if(document.getElementById('tafs-outstanding')) document.getElementById('tafs-outstanding').innerText = fmtIDR(tafsMetrics.os);
    if(document.getElementById('tafs-paid')) document.getElementById('tafs-paid').innerText = `${tafsMetrics.paid} Unit`;
    if(document.getElementById('tafs-on-proses')) document.getElementById('tafs-on-proses').innerText = `${tafsMetrics.onProses} Unit`;
    if(document.getElementById('tafs-overdue')) document.getElementById('tafs-overdue').innerText = `${tafsMetrics.overdue} Unit`;

    if(document.getElementById('acc-outstanding')) document.getElementById('acc-outstanding').innerText = fmtIDR(accMetrics.os);
    if(document.getElementById('acc-paid')) document.getElementById('acc-paid').innerText = `${accMetrics.paid} Unit`;
    if(document.getElementById('acc-on-proses')) document.getElementById('acc-on-proses').innerText = `${accMetrics.onProses} Unit`;
    if(document.getElementById('acc-overdue')) document.getElementById('acc-overdue').innerText = `${accMetrics.overdue} Unit`;

    renderAgingChart(aging);
    renderDonutLeasing(mLeas);
    renderLeasingList(mLeas, s.os);
    renderTopList(mSales, 'list-sales', 'text-blue-600');
    renderTopList(mSpv, 'list-spv', 'text-purple-600');
    renderOverdueTop(mOverdueTop);
    
    renderTabLeasingFull(data);
    renderTabOverdueFull(data);
    renderDataArUnitFull(data); 
    renderTabDatabaseFull(data); 
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
        yaxis: { show: false }, grid: { show: false }, legend: { show: false }
    };
    if (charts.bar) charts.bar.updateOptions(options);
    else { charts.bar = new ApexCharts(el, options); charts.bar.render(); }
}

function renderDonutLeasing(mLeas) {
    const el = document.querySelector("#chart-donut-leasing");
    if (!el) return;

    let totalCash = 0, totalLeasing = 0;
    cachedData.forEach(d => {
        const os = Number(getProp(d, 'O/S Balance') || 0);
        const l = String(getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || 'CASH').toUpperCase().trim();
        if (["CASH", "CASH TERIMA", "", "-"].includes(l)) totalCash += os; else totalLeasing += os;
    });

    const options = {
        series: [totalCash, totalLeasing], labels: ['TOTAL CASH', 'TOTAL LEASING'],
        chart: { type: 'donut', height: 180 }, legend: { show: false }, dataLabels: { enabled: false },
        colors: ['#10B981', '#3B82F6'], plotOptions: { pie: { donut: { labels: { show: false } } } }
    };
    if (charts.donut) charts.donut.updateOptions(options);
    else { charts.donut = new ApexCharts(el, options); charts.donut.render(); }
}

function renderLeasingList(map, total) {
    const el = document.getElementById('leasing-list'); if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n, v]) => `
        <div class="mb-3">
            <div class="flex justify-between text-[9px] font-bold mb-1 uppercase"><span>${n}</span><span>${total > 0 ? ((v/total)*100).toFixed(1) : 0}%</span></div>
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div class="bg-blue-600 h-full" style="width: ${total > 0 ? (v/total)*100 : 0}%"></div></div>
        </div>`).join('');
}

function renderTopList(map, id, colorClass) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map((x,i) => `
        <div class="flex justify-between items-center py-3 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${x[0]}</span>
            <span class="text-[10px] ${colorClass}">${fmtJuta(x[1])}</span>
        </div>`).join('');
}

function renderOverdueTop(data) {
    const el = document.getElementById('list-overdue'); if (!el) return;
    const sortedData = [...data].sort((a, b) => {
        return (Number(getProp(b, 'Hari 1-30')||0)+Number(getProp(b, 'Hari 31-60')||0)+Number(getProp(b, 'Lebih 60 Hari')||0)) - (Number(getProp(a, 'Hari 1-30')||0)+Number(getProp(a, 'Hari 31-60')||0)+Number(getProp(a, 'Lebih 60 Hari')||0));
    });
    el.innerHTML = sortedData.slice(0,5).map((d,i) => {
        const totalOverdueItem = Number(getProp(d, 'Hari 1-30')||0) + Number(getProp(d, 'Hari 31-60')||0) + Number(getProp(d, 'Lebih 60 Hari')||0);
        return `
        <div class="flex justify-between py-2 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${getProp(d, 'Customer Name') || '-'}</span>
            <span class="text-[10px] text-red-500">${fmtJuta(totalOverdueItem)}</span>
        </div>`;
    }).join('');
}

// ========================================================
// 5. RENDERING TABEL ELEMEN SECARA LENGKAP UTUH
// ========================================================
function renderTabLeasingFull(data) {
    const el = document.getElementById('tab-leasing-full-list'); if (!el) return;
    const leasingData = data.filter(d => !["CASH", "CASH TERIMA", "", "-"].includes(String(getProp(d, 'Chas/Leasing') || '').toUpperCase().trim()));
    el.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-left border-collapse text-[10px]"><tbody>${leasingData.map((d, i) => `<tr class="hover:bg-slate-50 font-bold uppercase"><td class="p-3 text-center">${i+1}</td><td class="p-3">${getProp(d, 'Customer Name')||'-'}</td><td class="p-3">${getProp(d, 'Chas/Leasing')||'-'}</td><td class="p-3 text-right pr-6 text-blue-600">${fmtIDR(getProp(d, 'O/S Balance'))}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderTabOverdueFull(data) {
    const el = document.getElementById('tab-overdue-full-list'); if (!el) return;
    const overdueData = data.filter(d => (Number(getProp(d, 'Hari 1-30')||0)+Number(getProp(d, 'Hari 31-60')||0)+Number(getProp(d, 'Lebih 60 Hari')||0)) > 0);
    el.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-left border-collapse text-[10px]"><tbody>${overdueData.map((d, i) => `<tr class="hover:bg-slate-50 font-bold uppercase"><td class="p-3 text-center">${i+1}</td><td class="p-3">${getProp(d, 'Customer Name')||'-'}</td><td class="p-3 text-right text-red-600">${fmtIDR(Number(getProp(d, 'Hari 1-30')||0)+Number(getProp(d, 'Hari 31-60')||0)+Number(getProp(d, 'Lebih 60 Hari')||0))}</td></tr>`).join('')}</tbody></table></div>`;
}

// RENDERING UTAMA INPUT TAB AR UNIT (SINKRONISASI 100% ANTARA DASHBOARD & TAFS)
function renderDataArUnitFull(data) {
    const el = document.getElementById('tab-ar-unit-body');
    if (!el) return;

    // Filter baris yang hanya mengandung TAFS atau ACC
    const filterAR = data.filter(d => {
        const l = String(getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || '').toUpperCase().trim();
        return l.includes('TAFS') || l.includes('ACC');
    });

    if(filterAR.length === 0) { 
        el.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-400 font-bold">Tidak ada unit dengan Leasing TAFS / ACC</td></tr>'; 
        return; 
    }

    // Cek apakah user sedang membuka file tafs.html atau acc.html
    const isLeasingView = window.location.pathname.includes('tafs') || window.location.pathname.includes('acc');

    el.innerHTML = filterAR.map((d, i) => {
        // AMBIL KEY ID YANG BENAR DARI DATABASE SUPABASE
        const recordId = d.id || getProp(d, 'id') || getProp(d, 'No') || i;
        const isiKetCabang = getProp(d, 'ket_cabang') || '';
        const isiPlanLeasing = getProp(d, 'plan_bayar_leasing') || '';
        const isiKetLeasing = getProp(d, 'ket_leasing') || '';

        return `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap text-[11px]">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4 text-slate-800 font-black">${getProp(d, 'Customer Name') || getProp(d, 'customer_name') || '-'}</td>
            <td class="p-4">
                <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded text-[9px] font-extrabold tracking-wide">${getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || '-'}</span>
            </td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(getProp(d, 'O/S Balance') || getProp(d, 'os_balance'))}</td>
            
            <td class="p-4 w-48">
                <input type="text" 
                       id="cabang-${recordId}" 
                       value="${isiKetCabang}" 
                       placeholder="Ket cabang..." 
                       class="input-custom ${isLeasingView ? 'bg-slate-100 text-slate-500 cursor-not-allowed font-medium' : 'bg-white border-blue-300'}" 
                       ${isLeasingView ? 'readonly' : ''}>
            </td>
            
            <td class="p-4 w-48">
                <input type="text" 
                       id="plan-${recordId}" 
                       value="${isiPlanLeasing}" 
                       placeholder="Isi plan bayar..." 
                       class="input-custom ${isLeasingView ? 'bg-white border-emerald-300' : 'bg-slate-50 text-slate-500 cursor-not-allowed font-medium'}" 
                       ${isLeasingView ? '' : 'readonly'}>
            </td>
            
            <td class="p-4 w-48">
                <input type="text" 
                       id="ket-${recordId}" 
                       value="${isiKetLeasing}" 
                       placeholder="Isi ket leasing..." 
                       class="input-custom ${isLeasingView ? 'bg-white border-emerald-300' : 'bg-slate-50 text-slate-500 cursor-not-allowed font-medium'}" 
                       ${isLeasingView ? '' : 'readonly'}>
            </td>
            
            <td class="p-4 text-center w-16">
                ${isLeasingView ? 
                    `<button onclick="simpanCatatanLeasing('${recordId}', '${i}')" class="text-emerald-600 hover:bg-emerald-600 hover:text-white bg-emerald-50 p-2 rounded-lg transition-all font-bold" title="Simpan oleh Pihak Leasing">💾</button>` :
                    `<button onclick="simpanCatatan('${recordId}', '${i}')" class="text-blue-600 hover:bg-blue-600 hover:text-white bg-blue-50 p-2 rounded-lg transition-all font-bold" title="Simpan Catatan Cabang Utama">💾</button>`
                }
            </td>
        </tr>`;
    }).join('');
}

function renderTabDatabaseFull(data) {
    const el = document.getElementById('tab-database-body'); if (!el) return;
    el.innerHTML = data.map((d, i) => `<tr class="hover:bg-slate-50 font-bold uppercase text-[10px]"><td class="p-4 text-center">${i+1}</td><td class="p-4">${getProp(d, 'Customer Name')||'-'}</td><td class="p-4">${getProp(d, 'Chas/Leasing')||'CASH'}</td><td class="p-4 text-right">${fmtIDR(getProp(d, 'O/S Balance'))}</td></tr>`).join('');
}

// ========================================================
// 6. LOGIKA SAVE DUA ARAH (ANTI DATA TERTIMPA & ANTI-HILANG)
// ========================================================

// [A] TOMBOL SAVE DI DASHBOARD ADMIN (Update Ket Cabang)
window.simpanCatatan = async function(recordId, indexFallback) {
    try {
        const inputElement = document.getElementById(`cabang-${recordId}`);
        if (!inputElement) return;
        const valCabang = inputElement.value;

        let queryBuilder = supabase.from('ar_unit').update({ ket_cabang: valCabang });

        // Utamakan tembak target UUID Supabase, jika kosong pakai fallback Nama Customer
        if (isNaN(recordId)) {
            queryBuilder = queryBuilder.eq('id', recordId);
        } else {
            const indexNumber = parseInt(indexFallback);
            const namaCust = getProp(cachedData[indexNumber], 'Customer Name') || getProp(cachedData[indexNumber], 'customer_name');
            queryBuilder = queryBuilder.eq('Customer Name', namaCust);
        }

        const { error } = await queryBuilder;
        if (error) throw error;
        
        alert("Keterangan cabang berhasil disimpan ke database! 👍");
        fetchData(); // Muat ulang data real-time agar halaman lain langsung membaca
        
    } catch (err) {
        console.error(err);
        alert("Gagal menyimpan data cabang: " + err.message);
    }
}

// [B] TOMBOL SAVE DI TAFS / ACC (Update Plan & Keterangan Leasing - Mengunci Ket Cabang)
window.simpanCatatanLeasing = async function(recordId, indexFallback) {
    try {
        const inputPlan = document.getElementById(`plan-${recordId}`);
        const inputKet = document.getElementById(`ket-${recordId}`);
        
        if (!inputPlan || !inputKet) return;

        const valPlan = inputPlan.value;
        const valKetLeasing = inputKet.value;

        // KUNCI UTAMA: Hanya update plan dan ket_leasing, kolom ket_cabang jangan dikosongkan!
        let queryBuilder = supabase.from('ar_unit').update({ 
            plan_bayar_leasing: valPlan,
            ket_leasing: valKetLeasing
        });

        if (isNaN(recordId)) {
            queryBuilder = queryBuilder.eq('id', recordId);
        } else {
            const indexNumber = parseInt(indexFallback);
            const namaCust = getProp(cachedData[indexNumber], 'Customer Name') || getProp(cachedData[indexNumber], 'customer_name');
            queryBuilder = queryBuilder.eq('Customer Name', namaCust);
        }

        const { error } = await queryBuilder;
        if (error) throw error;
        
        alert("Respon Leasing (Plan & Keterangan) Berhasil Tersimpan! ✔️");
        fetchData(); // Paksa sinkronisasi ulang agar dashboard utama langsung membaca hasilnya
        
    } catch (err) {
        console.error(err);
        alert("Gagal menyimpan data leasing: " + err.message);
    }
}

// ========================================================
// 7. INITIALIZATION ON READY
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    const btnDownload = document.getElementById('btn-download-excel');
    if (btnDownload) { btnDownload.addEventListener('click', downloadExcel); }
});