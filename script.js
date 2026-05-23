import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let cachedData = []; 

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

// Helper pencari properti objek (mengatasi perbedaan uppercase/lowercase/snake_case kolom database)
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

// 1. FUNGSI AMBIL DATA (BEBAS ERROR ORDER BY ID)
async function fetchData() {
    try {
        let query = supabase.from('ar_unit').select('*');
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
            cachedData = data; 
            updateDashboard(data);
            
            if (document.getElementById('status-update')) {
                document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
                document.getElementById('status-update').className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
            }
        }
    } catch (e) {
        console.error("Error Fetching:", e);
        if (document.getElementById('status-update')) {
            document.getElementById('status-update').innerText = `KONEKSI GAGAL ATAU NAMA TABEL SALAH: ${e.message}`;
            document.getElementById('status-update').className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
        }
    }
}

// 2. LOGIKA UTAMA HITUNG METRIK DASHBOARD
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {};
    let overdueList = [];

    data.forEach(d => {
        const os = Number(getProp(d, 'O/S Balance') || getProp(d, 'os_balance') || 0);
        const b1_30 = Number(getProp(d, 'Hari 1-30') || getProp(d, 'hari_1_30') || 0);
        const b31_60 = Number(getProp(d, 'Hari 31-60') || getProp(d, 'hari_31_60') || 0);
        const b60 = Number(getProp(d, 'Lebih 60 Hari') || getProp(d, 'lebih_60_hari') || 0);
        
        const ov = (getProp(d, 'Total Overdue') !== undefined) ? Number(getProp(d, 'Total Overdue')) : (b1_30 + b31_60 + b60);
        const l = String(getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || getProp(d, 'leasing_name') || 'CASH').toUpperCase().trim();
        const penalti = Number(getProp(d, 'Potensi Penalti') || getProp(d, 'penalty_amount') || 0);
        const lancarNominal = ov === 0 ? os : (os - ov > 0 ? os - ov : 0);

        s.os += os; s.ov += ov; s.pen += penalti; s.lan += lancarNominal;
        
        if (ov > 0) { 
            s.countOv++; 
            overdueList.push({ name: getProp(d, 'Customer Name') || 'No Name', val: ov });
        }
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
        }

        const rawSales = String(getProp(d, 'Salesman Name') || getProp(d, 'salesman_name') || "").trim();
        const rawSpv = String(getProp(d, 'Supervisor') || getProp(d, 'supervisor_name') || "").trim();
        
        mSales[rawSales || "OFFICE"] = (mSales[rawSales || "OFFICE"] || 0) + os;
        mSpv[rawSpv || "OFFICE"] = (mSpv[rawSpv || "OFFICE"] || 0) + os;
    });

    // MASUKKAN DATA KE ELEMEN KARTU RINGKASAN HTML ANDA
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    if(document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    
    if(document.getElementById('badge-overdue')) document.getElementById('badge-overdue').innerText = `${s.countOv} SPK Lewat TOP`;
    if(document.getElementById('spk-penalty')) document.getElementById('spk-penalty').innerText = `${s.cPen} SPK`;

    // PROGRESS BAR RINGKASAN CARD
    const pctCash = s.os > 0 ? (s.cash / s.os) * 100 : 0;
    const pctLeas = s.os > 0 ? (s.leas / s.os) * 100 : 0;
    if(document.getElementById('bar-cash')) document.getElementById('bar-cash').style.width = `${pctCash}%`;
    if(document.getElementById('bar-leasing')) document.getElementById('bar-leasing').style.width = `${pctLeas}%`;

    // METRIK BREAKDOWN DETAIL
    if(document.getElementById('val-total-cash')) document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    if(document.getElementById('unit-total-cash')) document.getElementById('unit-total-cash').innerText = `${s.cCash} Unit`;
    if(document.getElementById('val-total-leas')) document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    if(document.getElementById('unit-total-leas')) document.getElementById('unit-total-leas').innerText = `${s.cLeas} Unit`;

    renderCharts(aging, s.cash, s.leas);
    renderWidgets(mSales, mSpv, overdueList, mLeas);
    renderTableInputControl(data);
    renderTableDatabaseLengkap(data);
}

// 3. RENDER GRAFIK APEXCHARTS
function renderCharts(aging, cashVal, leasVal) {
    // Bar Chart Aging Analysis
    const elBar = document.querySelector("#chart-aging");
    if (elBar) {
        const barOptions = {
            series: [{ name: 'Nominal', data: Object.values(aging) }],
            chart: { type: 'bar', height: 200, toolbar: { show: false } },
            colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
            plotOptions: { bar: { borderRadius: 4, distributed: true } },
            dataLabels: { enabled: false },
            xaxis: { categories: Object.keys(aging) },
            yaxis: { labels: { formatter: (v) => (v / 1000000).toFixed(0) + " Jt" } }
        };
        if (charts.bar) charts.bar.updateOptions(barOptions); else { charts.bar = new ApexCharts(elBar, barOptions); charts.bar.render(); }
    }

    // Donut Chart Composition
    const elDonut = document.querySelector("#chart-donut-leasing");
    if (elDonut) {
        const donutOptions = {
            series: [cashVal, leasVal],
            labels: ['CASH', 'LEASING'],
            chart: { type: 'donut', height: 140 },
            colors: ['#34D399', '#2563EB'],
            legend: { show: false },
            dataLabels: { enabled: false }
        };
        if (charts.donut) charts.donut.updateOptions(donutOptions); else { charts.donut = new ApexCharts(elDonut, donutOptions); charts.donut.render(); }
    }
}

// 4. INJECT DATA KE WIDGET LIST (SALES, OVERDUE, SPV, LIST LEASING)
function renderWidgets(mSales, mSpv, overdueList, mLeas) {
    // List Leasing Breakdown
    const elLeas = document.getElementById('leasing-list');
    if (elLeas) {
        elLeas.innerHTML = Object.entries(mLeas).map(([k, v]) => `
            <div class="flex justify-between items-center text-[10px]">
                <span class="font-bold text-slate-700">${k}</span>
                <span class="font-black text-blue-600">${fmtIDR(v)}</span>
            </div>
        `).join('');
    }

    // Top Salesman
    const elSales = document.getElementById('list-sales');
    if (elSales) {
        const sorted = Object.entries(mSales).sort((a,b) => b[1] - a[1]).slice(0, 5);
        elSales.innerHTML = sorted.map(([k, v]) => `
            <div class="flex justify-between items-center text-[10px]">
                <span class="font-medium text-slate-600 truncate max-w-[120px]">${k}</span>
                <span class="font-bold">${fmtIDR(v)}</span>
            </div>
        `).join('');
    }

    // Top Overdue 5
    const elOverdue = document.getElementById('list-overdue');
    if (elOverdue) {
        const sorted = overdueList.sort((a,b) => b.val - a.val).slice(0, 5);
        elOverdue.innerHTML = sorted.map(x => `
            <div class="flex justify-between items-center text-[10px]">
                <span class="font-medium text-slate-600 truncate max-w-[120px]">${x.name}</span>
                <span class="font-bold text-red-600">${fmtIDR(x.val)}</span>
            </div>
        `).join('');
    }

    // Top SPV
    const elSpv = document.getElementById('list-spv');
    if (elSpv) {
        const sorted = Object.entries(mSpv).sort((a,b) => b[1] - a[1]).slice(0, 3);
        elSpv.innerHTML = sorted.map(([k, v]) => `
            <div class="flex justify-between items-center text-[10px]">
                <span class="font-medium text-slate-600">${k}</span>
                <span class="font-bold text-purple-600">${fmtIDR(v)}</span>
            </div>
        `).join('');
    }
}

// 5. INJECT KE TAB-CONTENT "DATA AR UNIT" (#tab-ar-unit-body)
function renderTableInputControl(data) {
    const el = document.getElementById('tab-ar-unit-body');
    if (!el) return;

    el.innerHTML = data.map((d, i) => {
        const custName = getProp(d, 'Customer Name') || getProp(d, 'customer_name') || '-';
        const encodedCustName = encodeURIComponent(custName);
        
        return `
        <tr class="font-medium text-slate-700">
            <td class="p-4 text-center text-slate-400 font-bold">${i + 1}</td>
            <td class="p-4 font-bold text-slate-900">${custName}</td>
            <td class="p-4"><span class="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[9px] font-bold">${getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || '-'}</span></td>
            <td class="p-4 text-right font-bold text-slate-900">${fmtIDR(getProp(d, 'O/S Balance'))}</td>
            <td class="p-4"><input type="text" id="cabang-${i}" value="${getProp(d, 'ket_cabang') || ''}" class="input-custom" placeholder="..."></td>
            <td class="p-4"><input type="text" id="plan-${i}" value="${getProp(d, 'plan_bayar_leasing') || ''}" class="input-custom" placeholder="..."></td>
            <td class="p-4"><input type="text" id="ket-${i}" value="${getProp(d, 'ket_leasing') || ''}" class="input-custom" placeholder="..."></td>
            <td class="p-4 text-center">
                <button onclick="simpanRowData('${encodedCustName}', ${i})" class="bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold hover:bg-blue-600 hover:text-white transition-all cursor-pointer">💾</button>
            </td>
        </tr>`;
    }).join('');
}

// 6. INJECT KE TAB-CONTENT "DATABASE LENGKAP" (#tab-database-body)
function renderTableDatabaseLengkap(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;

    el.innerHTML = data.map((d, i) => `
        <tr class="text-slate-600">
            <td class="p-4 text-center font-bold text-slate-400">${i + 1}</td>
            <td class="p-4 font-bold text-slate-900">${getProp(d, 'Customer Name') || '-'}</td>
            <td class="p-4">${getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || '-'}</td>
            <td class="p-4 text-right font-bold text-slate-900">${fmtIDR(getProp(d, 'O/S Balance'))}</td>
            <td class="p-4 text-right text-emerald-600">${fmtIDR(getProp(d, 'Hari 1-30'))}</td>
            <td class="p-4 text-right text-amber-500">${fmtIDR(getProp(d, 'Hari 31-60'))}</td>
            <td class="p-4 text-right text-red-500">${fmtIDR(getProp(d, 'Lebih 60 Hari'))}</td>
            <td class="p-4 text-right font-bold text-red-600">${fmtIDR(getProp(d, 'Total Overdue') || (Number(getProp(d, 'Hari 1-30')||0) + Number(getProp(d, 'Hari 31-60')||0) + Number(getProp(d, 'Lebih 60 Hari')||0)))}</td>
        </tr>
    `).join('');
}

// 7. AKSI SIMPAN KE DATABASE BERDASARKAN KRITERIA NAMA CUSTOMER (MENGHINDARI PROBLEM ID)
window.simpanRowData = async function(encodedCustName, index) {
    try {
        const customerTarget = decodeURIComponent(encodedCustName);
        
        const valCabang = document.getElementById(`cabang-${index}`).value;
        const valPlan = document.getElementById(`plan-${index}`).value;
        const valKet = document.getElementById(`ket-${index}`).value;

        const payload = {
            ket_cabang: valCabang,
            plan_bayar_leasing: valPlan,
            ket_leasing: valKet
        };

        // Coba simpan menggunakan penanda kolom Excel Standar 'Customer Name'
        let { error } = await supabase
            .from('ar_unit')
            .update(payload)
            .eq('Customer Name', customerTarget);

        // Fallback pencarian jika nama kolom berformat snake_case di Supabase
        if (error) {
            const { error: errorRetry } = await supabase
                .from('ar_unit')
                .update(payload)
                .eq('customer_name', customerTarget);
            if (errorRetry) throw errorRetry;
        }

        alert("Perubahan berhasil disimpan ke database! ✔️");
        fetchData();
    } catch (err) {
        alert("Gagal menyimpan data: " + err.message);
    }
}

// Jalankan load data saat halaman siap
document.addEventListener('DOMContentLoaded', fetchData);