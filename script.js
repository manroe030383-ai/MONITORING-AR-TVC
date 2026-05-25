import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// ========================================================
// 1. KONFIGURASI UTAMA DATABASE SUPABASE AUTO2000
// ========================================================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = { bar: null, donut: null }; 
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
            console.log("DATA BERHASIL DITARIK:", data.length, "baris"); 
            cachedData = data; 
            updateDashboard(data);
            
            if (document.getElementById('status-update')) {
                document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
                document.getElementById('status-update').className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
            }

            if (document.getElementById('tgl-arsip')) {
                const opsiTanggal = { year: 'numeric', month: 'short', day: 'numeric' };
                document.getElementById('tgl-arsip').innerText = new Date().toLocaleDateString('id-ID', opsiTanggal).toUpperCase();
            }
        }
    } catch (e) {
        console.error("Error Fetching:", e);
        if (document.getElementById('status-update')) {
            document.getElementById('status-update').innerText = `KONEKSI GAGAL: ${e.message}`;
            document.getElementById('status-update').className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
        }
    }
}

// ========================================================
// 3. FUNGSI HITUNG METRIK DASHBOARD
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
        const ov = b1_30 + b31_60 + b60;
        
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

        aging['LANCAR'] += lancarNominal;
        aging['1-30 H'] += b1_30;
        aging['31-60 H'] += b31_60;
        aging['>60 H'] += b60;

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
            if (statusTagih === 'SUDAH GI' || os === 0) { tafsMetrics.paid++; } 
            else { tafsMetrics.os += os; if (ov > 0) tafsMetrics.overdue++; else tafsMetrics.onProses++; }
        } else if (l.includes('ACC')) {
            if (statusTagih === 'SUDAH GI' || os === 0) { accMetrics.paid++; } 
            else { accMetrics.os += os; if (ov > 0) accMetrics.overdue++; else accMetrics.onProses++; }
        }

        const rawSales = String(getProp(d, 'Salesman Name') || getProp(d, 'salesman_name') || "").trim();
        const rawSpv = String(getProp(d, 'Supervisor') || getProp(d, 'supervisor_name') || "").trim();
        const finalSales = rawSales !== "" ? rawSales : "OFFICE";
        const finalSpv = rawSpv !== "" ? rawSpv : "OFFICE";

        mSales[finalSales] = (mSales[finalSales] || 0) + os;
        mSpv[finalSpv] = (mSpv[finalSpv] || 0) + os;
    });

    // Pasang ke UI Element
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    if(document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    if(document.getElementById('badge-overdue')) document.getElementById('badge-overdue').innerText = `${s.countOv} SPK LEWAT TOP`;
    if(document.getElementById('spk-penalty')) document.getElementById('spk-penalty').innerText = `${s.cPen} SPK`;
    
    if(s.os > 0) {
        if(document.getElementById('bar-cash')) document.getElementById('bar-cash').style.width = `${(s.cash/s.os)*100}%`;
        if(document.getElementById('bar-leasing')) document.getElementById('bar-leasing').style.width = `${(s.leas/s.os)*100}%`;
    }
    
    if(document.getElementById('val-total-cash')) document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    if(document.getElementById('unit-total-cash')) document.getElementById('unit-total-cash').innerText = `${s.cCash} Unit`;
    if(document.getElementById('val-total-leas')) document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    if(document.getElementById('unit-total-leas')) document.getElementById('unit-total-leas').innerText = `${s.cLeas} Unit`;

    if(document.getElementById('total-unit-tvc')) document.getElementById('total-unit-tvc').innerText = `${tvc.total} Unit`;
    if(document.getElementById('unit-gi-tvc')) document.getElementById('unit-gi-tvc').innerText = `${tvc.gi} Unit`;
    if(document.getElementById('unit-delivery-tvc')) document.getElementById('unit-delivery-tvc').innerText = `${tvc.deliv} Unit`;

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
// 4. LOGIKA SINKRONISASI TABEL UTAMA (INPUT CONTROL PERUBAHAN CABANG)
// ========================================================
function renderDataArUnitFull(data) {
    const el = document.getElementById('tab-ar-unit-body');
    if (!el) return;

    // KARENA KITA DI SATU HALAMAN (SPA): Tampilkan seluruh data AR untuk dikontrol admin cabang
    el.innerHTML = data.map((d, i) => {
        const spkAsli = String(getProp(d, 'No SPK') || getProp(d, 'no_spk') || '').trim();
        const idSistem = spkAsli.replace(/[^a-zA-Z0-9]/g, '_');
        
        const ketCabangVal = d.ket_cabang || getProp(d, 'ket_cabang') || '';
        const planBayarVal = d.plan_bayar_leasing || getProp(d, 'plan_bayar_leasing') || '';
        const ketLeasingVal = d.ket_leasing || getProp(d, 'ket_leasing') || '';

        return `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4">
                <p class="text-slate-800 font-black text-[11px]">${getProp(d, 'Customer Name') || getProp(d, 'customer_name') || '-'}</p>
                <p class="text-[9px] text-slate-400 font-medium tracking-wide mt-0.5">SPK: ${spkAsli}</p>
            </td>
            <td class="p-4">
                <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded text-[9px] font-extrabold tracking-wide">${getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || '-'}</span>
            </td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(getProp(d, 'O/S Balance') || getProp(d, 'os_balance'))}</td>
            
            <td class="p-4 w-48">
                <input type="text" id="cabang-${idSistem}" value="${ketCabangVal}" placeholder="Ket cabang..." class="input-custom bg-white">
            </td>
            
            <td class="p-4 w-48">
                <input type="text" id="plan-${idSistem}" value="${planBayarVal}" placeholder="Plan bayar leasing..." class="input-custom bg-white">
            </td>
            <td class="p-4 w-48">
                <input type="text" id="ket-${idSistem}" value="${ketLeasingVal}" placeholder="Keterangan leasing..." class="input-custom bg-white">
            </td>
            
            <td class="p-4 text-center w-16">
                <button onclick="simpanSemuaCatatan('${spkAsli}')" class="text-blue-600 hover:bg-blue-600 hover:text-white bg-blue-50 p-2 rounded-lg transition-all" title="Simpan Perubahan">💾</button>
            </td>
        </tr>`;
    }).join('');
}

// ========================================================
// 5. FUNGSI SIMPAN INTEGRASI KE SUPABASE
// ========================================================
window.simpanSemuaCatatan = async function(nomorSPK) {
    try {
        const idSistem = nomorSPK.replace(/[^a-zA-Z0-9]/g, '_');
        const inputCabang = document.getElementById(`cabang-${idSistem}`);
        const inputPlan = document.getElementById(`plan-${idSistem}`);
        const inputKet = document.getElementById(`ket-${idSistem}`);
        
        if (!inputCabang || !inputPlan || !inputKet) return;
        
        const valCabang = inputCabang.value;
        const valPlan = inputPlan.value;
        const valKet = inputKet.value;

        const dataRow = cachedData.find(d => String(getProp(d, 'No SPK') || getProp(d, 'no_spk') || '').trim() === String(nomorSPK).trim());
        if (!dataRow) { alert("Data SPK tidak ditemukan."); return; }

        let kolomSPK = dataRow['No SPK'] !== undefined ? 'No SPK' : 'no_spk';

        // Lakukan update serentak ke 3 kolom di database Supabase Anda
        const { error } = await supabase
            .from('ar_unit')
            .update({ 
                ket_cabang: valCabang,
                plan_bayar_leasing: valPlan,
                ket_leasing: valKet
            })
            .eq(kolomSPK, nomorSPK);

        if (error) throw error;
        alert("Perubahan data SPK " + nomorSPK + " Berhasil Disimpan ke Database! ✔️");
        
    } catch (err) {
        console.error(err);
        alert("Gagal menyimpan: " + err.message);
    }
}

// ========================================================
// 6. RENDER VISUAL DIAGRAM (APEXCHARTS)
// ========================================================
function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging"); if (!el) return;
    const options = {
        series: [{ name: 'IDR', data: Object.values(agingData) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: (v) => fmtJuta(v), style: { fontSize: '9px', fontWeight: 800 }, offsetY: -20 },
        xaxis: { categories: Object.keys(agingData), labels: { style: { fontSize: '9px', fontWeight: 700 } } },
        yaxis: { show: false }, grid: { show: false }, legend: { show: false }
    };
    if (charts.bar) charts.bar.updateOptions(options); else { charts.bar = new ApexCharts(el, options); charts.bar.render(); }
}

function renderDonutLeasing(mLeas) {
    const el = document.querySelector("#chart-donut-leasing"); if (!el) return;
    let totalCash = 0; let totalLeasing = 0;
    cachedData.forEach(d => {
        const os = Number(getProp(d, 'O/S Balance') || 0);
        const l = String(getProp(d, 'Chas/Leasing') || 'CASH').toUpperCase().trim();
        if (["CASH", "CASH TERIMA", "", "-"].includes(l)) totalCash += os; else totalLeasing += os;
    });
    const options = {
        series: [totalCash, totalLeasing], labels: ['TOTAL CASH', 'TOTAL LEASING'],
        chart: { type: 'donut', height: 180 }, legend: { show: false }, dataLabels: { enabled: false },
        colors: ['#10B981', '#3B82F6'], plotOptions: { pie: { donut: { labels: { show: false } } } }
    };
    if (charts.donut) charts.donut.updateOptions(options); else { charts.donut = new ApexCharts(el, options); charts.donut.render(); }
}

// ========================================================
// 7. RENDER DAFTAR ELEMEN PENDUKUNG WIDGET
// ========================================================
function renderLeasingList(map, total) {
    const el = document.getElementById('leasing-list'); if (!el) return;
    if (Object.keys(map).length === 0) { el.innerHTML = ''; return; }
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
        return (Number(getProp(b, 'Hari 1-30')||0)+Number(getProp(b, 'Hari 31-60')||0)+Number(getProp(b, 'Lebih 60 Hari')||0)) - 
               (Number(getProp(a, 'Hari 1-30')||0)+Number(getProp(a, 'Hari 31-60')||0)+Number(getProp(a, 'Lebih 60 Hari')||0));
    });
    el.innerHTML = sortedData.slice(0,5).map((d,i) => {
        const tot = Number(getProp(d, 'Hari 1-30')||0)+Number(getProp(d, 'Hari 31-60')||0)+Number(getProp(d, 'Lebih 60 Hari')||0);
        return `
        <div class="flex justify-between py-2 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${getProp(d, 'Customer Name')||'-'}</span>
            <span class="text-[10px] text-red-500">${fmtJuta(tot)}</span>
        </div>`;
    }).join('');
}

function renderTabLeasingFull(data) {
    const el = document.getElementById('tab-leasing-full-list'); if (!el) return;
    const filtered = data.filter(d => !["CASH", "CASH TERIMA", "", "-"].includes(String(getProp(d, 'Chas/Leasing')||'').toUpperCase().trim()));
    el.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-left text-[10px] font-bold uppercase divide-y divide-slate-100">
        <tr class="bg-slate-50 text-slate-400"><th class="p-3 text-center">No</th><th class="p-3">Customer / Sales</th><th class="p-3">Leasing</th><th class="p-3 text-right">O/S Balance</th></tr>
        ${filtered.map((d,i)=>`<tr class="border-b border-slate-50"><td class="p-3 text-center text-slate-400">${i+1}</td><td class="p-3"><p class="text-slate-800 font-black">${getProp(d,'Customer Name')||'-'}</p><p class="text-[8px] text-slate-400">👤 ${getProp(d,'Salesman Name')||'OFFICE'}</p></td><td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">${getProp(d,'Chas/Leasing')||'-'}</span></td><td class="p-3 text-right text-blue-600 font-black">${fmtIDR(getProp(d,'O/S Balance'))}</td></tr>`).join('')}
    </table></div>`;
}

function renderTabOverdueFull(data) {
    const el = document.getElementById('tab-overdue-full-list'); if (!el) return;
    const filtered = data.filter(d => (Number(getProp(d,'Hari 1-30')||0)+Number(getProp(d,'Hari 31-60')||0)+Number(getProp(d,'Lebih 60 Hari')||0)) > 0);
    el.innerHTML = `<div class="overflow-x-auto"><table class="w-full text-left text-[10px] font-bold uppercase divide-y divide-slate-100">
        <tr class="bg-slate-50 text-slate-400"><th class="p-3 text-center">No</th><th class="p-3">Customer</th><th class="p-3 text-right bg-red-50/50">Total Overdue</th><th class="p-3 text-right">O/S Balance</th></tr>
        ${filtered.map((d,i)=>{ const tot=(Number(getProp(d,'Hari 1-30')||0)+Number(getProp(d,'Hari 31-60')||0)+Number(getProp(d,'Lebih 60 Hari')||0)); return `<tr class="border-b border-slate-50"><td class="p-3 text-center text-slate-400">${i+1}</td><td class="p-3 text-slate-800 font-black">${getProp(d,'Customer Name')||'-'}</td><td class="p-3 text-right text-red-600 bg-red-50/10 font-black">${fmtIDR(tot)}</td><td class="p-3 text-right text-blue-600">${fmtIDR(getProp(d,'O/S Balance'))}</td></tr>`}).join('')}
    </table></div>`;
}

function renderTabDatabaseFull(data) {
    const el = document.getElementById('tab-database-body'); if (!el) return;
    el.innerHTML = data.map((d, i) => {
        const os = Number(getProp(d, 'O/S Balance') || 0);
        const b1 = Number(getProp(d, 'Hari 1-30') || 0); const b2 = Number(getProp(d, 'Hari 31-60') || 0); const b3 = Number(getProp(d, 'Lebih 60 Hari') || 0);
        const ov = b1+b2+b3; const lancar = ov === 0 ? os : (os-ov > 0 ? os-ov : 0);
        return `<tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4 text-slate-800 font-black">${getProp(d, 'Customer Name') || '-'}</td>
            <td class="p-4"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">${getProp(d, 'Chas/Leasing') || 'CASH'}</span></td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(os)}</td>
            <td class="p-4 text-right text-emerald-600">${fmtIDR(lancar)}</td>
            <td class="p-4 text-right text-amber-500">${fmtIDR(b1)}</td>
            <td class="p-4 text-right text-orange-500">${fmtIDR(b2)}</td>
            <td class="p-4 text-right text-red-500">${fmtIDR(b3)}</td>
            <td class="p-4 text-right text-red-600 font-black bg-red-50/30">${fmtIDR(ov)}</td>
        </tr>`;
    }).join('');
}

// ========================================================
// 8. DOWNLOAD EXCEL
// ========================================================
function downloadExcel() {
    if (!cachedData || cachedData.length === 0) return;
    const mapped = cachedData.map((d, idx) => {
        const os = Number(getProp(d, 'O/S Balance') || 0);
        const b1 = Number(getProp(d, 'Hari 1-30') || 0); const b2 = Number(getProp(d, 'Hari 31-60') || 0); const b3 = Number(getProp(d, 'Lebih 60 Hari') || 0);
        return {
            "No": idx + 1, "Customer": getProp(d, 'Customer Name') || "-", "No SPK": getProp(d, 'No SPK') || "-",
            "Leasing": getProp(d, 'Chas/Leasing') || "CASH", "O/S Balance": os, "Hari 1-30": b1, "Hari 31-60": b2, "Lebih 60 Hari": b3,
            "Ket Cabang": d.ket_cabang || "", "Plan Bayar": d.plan_bayar_leasing || "", "Ket Leasing": d.ket_leasing || ""
        };
    });
    const ws = XLSX.utils.json_to_sheet(mapped); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AR Unit");
    XLSX.writeFile(wb, `AR_Unit_Auto2000.xlsx`);
}

// ========================================================
// 9. EVENT INITIALIZATION & REALTIME LISTENERS
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
    const btnDownload = document.getElementById('btn-download-excel');
    if (btnDownload) btnDownload.addEventListener('click', downloadExcel);
    
    fetchData();

    // Listener Real-time Supabase: Otomatis render ulang jika data berubah di DB
    supabase.channel('public-ar-unit').on('postgres_changes', { event: '*', schema: 'public', table: 'ar_unit' }, () => {
        fetchData();
    }).subscribe();
});