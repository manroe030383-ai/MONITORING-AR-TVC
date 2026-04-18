import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let donutChart = null, barChart = null;

// 2. HELPER
const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const formatJuta = (n) => (Number(n) / 1000000).toFixed(1) + " Jt";
function updateText(id, value) { const el = document.getElementById(id); if (el) el.innerText = value; }

function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    updateText('tgl-update-text', `DATA UPDATE: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${time} WIB`);
}

// 3. FUNGSI LOAD DATA
async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) processDashboard(data);
    } catch (err) { console.error("Gagal menarik data:", err.message); }
}

// 4. PEMROSESAN DATA & TABEL LEASING
function processDashboard(data) {
    let totalOS = 0, totalOverdue = 0, totalPenalty = 0, totalLancarNominal = 0;
    let cashNominal = 0, leasingNominal = 0;
    let unitACC = 0, unitTAFS = 0, unitSudahGI = 0, unitRDelivery = 0;
    let spkOverdueCount = 0, spkPenaltyCount = 0;
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        const os = Number(d.os_balance) || 0;
        const overdue = Number(d.total_overd) || Number(d.total_overdue) || 0;
        const penalty = Number(d.penalty_amount) || 0;
        const leasingName = (d.leasing_name || '').toUpperCase().trim();

        totalOS += os;
        totalOverdue += overdue;
        totalPenalty += penalty;
        totalLancarNominal += (Number(d.lancar) || 0);
        if (overdue > 0) spkOverdueCount++;
        if (penalty > 0) spkPenaltyCount++;

        buckets['LANCAR'] += (Number(d.lancar) || 0) / 1000000;
        buckets['1-30 H'] += (Number(d.hari_1_30) || 0) / 1000000;
        buckets['31-60 H'] += (Number(d.hari_31_60) || 0) / 1000000;
        buckets['>60 H'] += (Number(d.lebih_60_hari) || 0) / 1000000;

        if (leasingName === "CASH" || leasingName === "" || leasingName === "CASH TERIMA") {
            cashNominal += os;
        } else {
            leasingNominal += os;
            if (leasingName.includes("ACC")) unitACC++;
            if (leasingName.includes("TAFS")) unitTAFS++;
            if (d.gl_date && d.gl_date !== "0") unitSudahGI++; else unitRDelivery++;
        }
    });

    // Update UI Stats
    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdue));
    updateText('total-penalty', formatIDR(totalPenalty));
    updateText('total-lancar', formatIDR(totalLancarNominal));
    updateText('count-overdue-spk', `${spkOverdueCount} SPK LEWAT TOP`);
    updateText('total-penjualan-leasing', (unitACC + unitTAFS) + " Unit");
    updateText('unit-sudah-gi', unitSudahGI + " Unit");
    updateText('unit-r-delivery', unitRDelivery + " Unit");
    updateText('val-total-cash', formatIDR(cashNominal));
    updateText('val-total-leasing', formatIDR(leasingNominal));

    // Progress Bar
    const barCash = document.getElementById('bar-cash');
    const barLeasing = document.getElementById('bar-leasing');
    if (barCash && totalOS > 0) barCash.style.width = `${(cashNominal / totalOS) * 100}%`;
    if (barLeasing && totalOS > 0) barLeasing.style.width = `${(leasingNominal / totalOS) * 100}%`;

    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
    renderLeasingBreakdown(data, totalOS);
    renderSalesList(data);
    renderOverdueList(data);
    renderTopSPV(data, totalOS);
    renderLeasingTable(data); // <--- Isi Tabel Leasing
}

function renderLeasingTable(data) {
    const tableBody = document.getElementById('leasing-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.forEach(d => {
        const lName = (d.leasing_name || '').toUpperCase().trim();
        if (lName !== "CASH" && lName !== "") {
            const row = document.createElement('tr');
            row.className = "bg-white hover:bg-slate-50 transition-all";
            row.innerHTML = `
                <td class="px-4 py-4 border-y border-l border-slate-50 rounded-l-2xl">
                    <span class="bg-blue-50 text-blue-600 text-[9px] font-black px-3 py-1.5 rounded-lg border border-blue-100 uppercase">${d.leasing_name || '-'}</span>
                </td>
                <td class="px-4 py-4 border-y border-slate-50">
                    <p class="text-[10px] font-black text-[#1B2559] uppercase">${d.customer_name || '-'}</p>
                    <p class="text-[8px] text-slate-400 font-bold">${d.no_spk || ''}</p>
                </td>
                <td class="px-4 py-4 border-y border-slate-50">
                    <p class="text-[10px] font-black text-[#1B2559] uppercase">${d.salesman_name || '-'}</p>
                    <p class="text-[8px] text-slate-400 font-bold">SPV: ${d.supervisor_name || '-'}</p>
                </td>
                <td class="px-4 py-4 border-y border-slate-50 text-center text-[10px] font-bold text-slate-500">${d.tgl_arsip || '-'}</td>
                <td class="px-4 py-4 border-y border-slate-50 text-center">
                    <span class="bg-slate-100 text-slate-600 text-[9px] font-black px-2 py-1 rounded-full">${d.hari_overdue || 0} HR</span>
                </td>
                <td class="px-4 py-4 border-y border-slate-50 text-right text-[10px] font-black text-[#1B2559]">${formatIDR(d.os_balance)}</td>
                <td class="px-4 py-4 border-y border-r border-slate-50 rounded-r-2xl">
                    <div class="max-w-[150px] truncate text-[9px] text-slate-400 font-medium italic">${d.keterangan || '-'}</div>
                </td>`;
            tableBody.appendChild(row);
        }
    });
}

// 5. CHART & LOGIKA LIST (Ringkasan tetap seperti sebelumnya)
function renderCharts(cash, leasing, agingData) {
    const donutEl = document.querySelector("#chart-donut-main");
    if (donutEl) {
        if (donutChart) donutChart.destroy();
        donutChart = new ApexCharts(donutEl, { series: [cash, leasing], labels: ['Cash', 'Leasing'], chart: { type: 'donut', height: 230 }, colors: ['#10B981', '#2563EB'], plotOptions: { pie: { donut: { size: '75%' } } }, legend: { position: 'bottom' } });
        donutChart.render();
    }
    const barEl = document.querySelector("#chart-aging-nominal");
    if (barEl) {
        if (barChart) barChart.destroy();
        barChart = new ApexCharts(barEl, { series: [{ name: 'Nominal (Jt)', data: agingData }], chart: { type: 'bar', height: 250 }, colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'], plotOptions: { bar: { distributed: true, borderRadius: 8 } }, xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] } });
        barChart.render();
    }
}

// (Fungsi renderLeasingBreakdown, renderSalesList, renderOverdueList, renderTopSPV sesuai dengan script Anda sebelumnya)
function renderLeasingBreakdown(data, totalOS) { /* ... isi sama ... */ }
function renderSalesList(data) { /* ... isi sama ... */ }
function renderOverdueList(data) { /* ... isi sama ... */ }
function renderTopSPV(data, totalOS) { /* ... isi sama ... */ }

// 6. INITIALIZATION & TAB NAVIGATION
function initTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const ringkasan = document.getElementById('main-dashboard-content');
    const leasing = document.getElementById('leasing-section');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            if (target === 'leasing') {
                ringkasan.classList.add('hidden');
                leasing.classList.remove('hidden');
            } else {
                ringkasan.classList.remove('hidden');
                leasing.classList.add('hidden');
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    loadData();
    initTabs();
    setInterval(updateDateTime, 60000);
    setInterval(loadData, 300000);
});// Auto refresh data setiap 5 menit