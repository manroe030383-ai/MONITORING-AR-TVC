import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// ========================================================
// 1. KONFIGURASI UTAMA
// ========================================================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = { bar: null, donut: null }; 
let cachedData = []; 

const urlPath = window.location.pathname.toLowerCase();
const isTafsPage = urlPath.includes('tafs');
const isAccPage = urlPath.includes('acc');

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

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
// 2. FUNGSI UTAMA FETCH & UPDATE
// ========================================================
async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        
        if (data) {
            let finalFilteredData = data;
            if (isTafsPage) finalFilteredData = data.filter(d => String(getProp(d, 'Chas/Leasing') || '').toUpperCase().includes('TAFS'));
            else if (isAccPage) finalFilteredData = data.filter(d => String(getProp(d, 'Chas/Leasing') || '').toUpperCase().includes('ACC'));

            cachedData = finalFilteredData; 
            updateDashboard(finalFilteredData);

            if (document.getElementById('status-update')) {
                document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleTimeString('id-ID')} WIB`;
            }
        }
    } catch (e) { console.error("Error Fetching:", e); }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {}, mOverdueTop = [];

    data.forEach(d => {
        const os = Number(getProp(d, 'O/S Balance') || getProp(d, 'os_balance') || 0);
        const b1 = Number(getProp(d, 'Hari 1-30') || getProp(d, 'hari_1_30') || 0);
        const b2 = Number(getProp(d, 'Hari 31-60') || getProp(d, 'hari_31_60') || 0);
        const b3 = Number(getProp(d, 'Lebih 60 Hari') || getProp(d, 'lebih_60_hari') || 0);
        const ov = b1 + b2 + b3;
        const l = String(getProp(d, 'Chas/Leasing') || 'CASH').toUpperCase().trim();
        
        s.os += os; s.ov += ov;
        aging['LANCAR'] += (os - ov > 0 ? os - ov : 0) / 1000000;
        aging['1-30 H'] += b1 / 1000000;
        aging['31-60 H'] += b2 / 1000000;
        aging['>60 H'] += b3 / 1000000;

        if (ov > 0) { s.countOv++; mOverdueTop.push(d); }
        if (l.includes('CASH')) { s.cash += os; s.cCash++; } else { s.leas += os; s.cLeas++; mLeas[l] = (mLeas[l] || 0) + os; }
    });

    // Update UI elements
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('badge-overdue').innerText = `${s.countOv} SPK LEWAT TOP`;
    document.getElementById('bar-cash').style.width = `${(s.cash/(s.os||1))*100}%`;
    document.getElementById('bar-leasing').style.width = `${(s.leas/(s.os||1))*100}%`;
    document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    document.getElementById('unit-total-cash').innerText = `${s.cCash} Unit`;
    document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    document.getElementById('unit-total-leas').innerText = `${s.cLeas} Unit`;

    renderAgingChart(aging);
    renderDonutLeasing(data);
    renderOverdueTop(mOverdueTop);
    renderTabDatabaseFull(data);
}

// ========================================================
// 3. FUNGSI GRAFIK & LIST
// ========================================================
function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging");
    if (!el) return;
    const options = {
        series: [{ data: Object.values(agingData).map(v => Math.round(v)) }],
        chart: { type: 'bar', height: 200 },
        xaxis: { categories: ['Lancar', '1-30 H', '31-60 H', '>60 H'] },
        colors: ['#EF4444']
    };
    if (charts.bar) charts.bar.updateOptions(options);
    else { charts.bar = new ApexCharts(el, options); charts.bar.render(); }
}

function renderDonutLeasing(data) {
    const el = document.querySelector("#chart-donut-leasing");
    if (!el) return;
    let cash = 0, leas = 0;
    data.forEach(d => {
        const os = Number(getProp(d, 'O/S Balance') || 0);
        if (String(getProp(d, 'Chas/Leasing') || '').toUpperCase().includes('CASH')) cash += os;
        else leas += os;
    });
    const options = { series: [cash, leas], chart: { type: 'donut', height: 180 }, labels: ['Cash', 'Leasing'], colors: ['#10B981', '#3B82F6'] };
    if (charts.donut) charts.donut.updateOptions(options);
    else { charts.donut = new ApexCharts(el, options); charts.donut.render(); }
}

function renderOverdueTop(data) {
    const el = document.getElementById('list-overdue');
    if (!el) return;
    el.innerHTML = data.slice(0, 5).map((d, i) => `
        <div class="flex justify-between text-[10px] mb-2 font-bold">
            <span class="truncate w-32 text-slate-700">${i+1}. ${getProp(d, 'Customer Name') || '-'}</span>
            <span class="text-red-600">${fmtJuta(getProp(d, 'Hari 1-30') + getProp(d, 'Hari 31-60') + getProp(d, 'Lebih 60 Hari'))}</span>
        </div>`).join('');
}

function renderTabDatabaseFull(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;
    el.innerHTML = data.map((d, i) => `
        <tr>
            <td class="p-2">${i+1}</td>
            <td class="p-2 font-bold">${getProp(d, 'Customer Name') || '-'}</td>
            <td class="p-2">${fmtIDR(getProp(d, 'O/S Balance') || 0)}</td>
            <td class="p-2 text-red-600 font-bold">${fmtIDR((getProp(d, 'Hari 1-30')||0) + (getProp(d, 'Hari 31-60')||0) + (getProp(d, 'Lebih 60 Hari')||0))}</td>
        </tr>`).join('');
}

// ========================================================
// 4. INISIALISASI AKHIR
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    // Real-time listener
    supabase.channel('ar_unit_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ar_unit' }, () => fetchData())
        .subscribe();
});

window.addEventListener('resize', () => {
    if (charts.bar) charts.bar.updateOptions({});
    if (charts.donut) charts.donut.updateOptions({});
});