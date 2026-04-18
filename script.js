import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let donutChart = null, barChart = null;

// 2. HELPER
const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
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
        if (data) {
            processDashboard(data);
            renderDetailedTables(data);
        }
    } catch (err) { console.error("Gagal menarik data:", err.message); }
}

// 4. PEMROSESAN DATA
function processDashboard(data) {
    let totalOS = 0, totalOverdue = 0, totalPenalty = 0, totalLancarNominal = 0;
    let cashNominal = 0, leasingNominal = 0;
    let unitACC = 0, unitTAFS = 0, unitSudahGI = 0, unitRDelivery = 0;
    let spkOverdueCount = 0, spkPenaltyCount = 0;
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        const os = Number(d.os_balance) || 0;
        const overdue = Number(d.total_overd) || 0;
        const penalty = Number(d.penalty_amount) || 0;
        const age = Number(d.hari_overdue) || 0;
        const leasingName = (d.leasing_name || '').toUpperCase().trim();

        totalOS += os;
        totalOverdue += overdue;
        totalPenalty += penalty;
        
        if (overdue > 0) spkOverdueCount++;
        if (penalty > 0) spkPenaltyCount++;

        // Aging Buckets
        if (age === 0) buckets['LANCAR'] += os / 1000000;
        else if (age <= 30) buckets['1-30 H'] += os / 1000000;
        else if (age <= 60) buckets['31-60 H'] += os / 1000000;
        else buckets['>60 H'] += os / 1000000;

        if (leasingName === "CASH" || leasingName === "") {
            cashNominal += os;
        } else {
            leasingNominal += os;
            if (leasingName.includes("ACC")) unitACC++;
            if (leasingName.includes("TAFS")) unitTAFS++;
            if (d.gl_date && d.gl_date !== "0") unitSudahGI++; else unitRDelivery++;
        }
    });

    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdue));
    updateText('total-penalty', formatIDR(totalPenalty));
    updateText('total-lancar', formatIDR(totalOS - totalOverdue));
    updateText('count-overdue-spk', `${spkOverdueCount} SPK LEWAT TOP`);
    updateText('total-penjualan-leasing', (unitACC + unitTAFS) + " Unit");
    updateText('unit-sudah-gi', unitSudahGI + " Unit");
    updateText('unit-r-delivery', unitRDelivery + " Unit");
    updateText('val-total-cash', formatIDR(cashNominal));
    updateText('val-total-leasing', formatIDR(leasingNominal));

    const barCash = document.getElementById('bar-cash');
    const barLeasing = document.getElementById('bar-leasing');
    if (barCash && totalOS > 0) barCash.style.width = `${(cashNominal / totalOS) * 100}%`;
    if (barLeasing && totalOS > 0) barLeasing.style.width = `${(leasingNominal / totalOS) * 100}%`;

    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
    renderLeasingTable(data);
    renderSalesList(data);
    renderOverdueList(data);
    renderTopSPV(data, totalOS);
}

// 5. RENDER TABEL DETAIL (TAB LEASING, OVERDUE, DATABASE)
function renderLeasingTable(data) {
    const tableBody = document.getElementById('leasing-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    data.filter(d => (d.leasing_name || '').toUpperCase() !== 'CASH').forEach(d => {
        const row = `
            <tr class="bg-white hover:bg-slate-50 border-b border-slate-50 transition-all">
                <td class="px-4 py-4"><span class="bg-blue-50 text-blue-600 text-[9px] font-black px-3 py-1 rounded-lg uppercase">${d.leasing_name}</span></td>
                <td class="px-4 py-4 font-black text-[#1B2559] text-[10px] uppercase">${d.customer_name}</td>
                <td class="px-4 py-4 font-bold text-[9px]">${d.salesman_name}<br><span class="text-slate-400">SPV: ${d.supervisor_name}</span></td>
                <td class="px-4 py-4 text-center text-slate-400 font-bold">${d.gl_date || '-'}</td>
                <td class="px-4 py-4 text-center"><span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-black">${d.hari_overdue || 0} HR</span></td>
                <td class="px-4 py-4 text-right font-black text-[#1B2559]">${formatIDR(d.os_balance)}</td>
                <td class="px-4 py-4 text-[9px] italic text-slate-400 truncate max-w-[100px]">${d.keterangan || '-'}</td>
            </tr>`;
        tableBody.insertAdjacentHTML('beforeend', row);
    });
}

function renderDetailedTables(data) {
    const overdueBody = document.getElementById('overdue-table-body');
    const databaseBody = document.getElementById('database-table-body');

    // Render Overdue
    if (overdueBody) {
        overdueBody.innerHTML = '';
        data.filter(d => (Number(d.total_overd) || 0) > 0).forEach(d => {
            const row = `
                <tr class="hover:bg-red-50/50 border-b border-slate-50">
                    <td class="px-4 py-4"><span class="bg-red-100 text-red-600 text-[9px] font-black px-3 py-1 rounded-full">${d.hari_overdue} HARI</span></td>
                    <td class="px-4 py-4 text-[#1B2559] font-black text-[10px] uppercase">${d.customer_name}</td>
                    <td class="px-4 py-4 text-[9px] font-bold">${d.salesman_name}<br><span class="text-slate-400 uppercase">SPV: ${d.supervisor_name}</span></td>
                    <td class="px-4 py-4 text-right font-black">${formatIDR(d.total_overd)}</td>
                    <td class="px-4 py-4 text-right text-red-600 font-bold">${formatIDR(d.penalty_amount)}</td>
                </tr>`;
            overdueBody.insertAdjacentHTML('beforeend', row);
        });
    }

    // Render Database Lengkap
    if (databaseBody) {
        databaseBody.innerHTML = '';
        updateText('total-row-db', `${data.length} RECORDS`);
        data.forEach((d, idx) => {
            const row = `
                <tr class="hover:bg-blue-50/30">
                    <td class="p-4 text-center text-slate-300 font-bold">${idx + 1}</td>
                    <td class="p-4 font-black text-[#1B2559] uppercase">${d.customer_name}</td>
                    <td class="p-4 text-slate-500 font-bold uppercase tracking-tighter">${d.no_spk || '-'}</td>
                    <td class="p-4 text-center font-black ${d.hari_overdue > 0 ? 'text-red-500' : 'text-emerald-500'}">${d.hari_overdue || 0}</td>
                    <td class="p-4 text-right font-black">${formatIDR(d.os_balance)}</td>
                    <td class="p-4 text-slate-500 font-bold text-[9px] uppercase">${d.salesman_name}</td>
                </tr>`;
            databaseBody.insertAdjacentHTML('beforeend', row);
        });
    }
}

// 6. LOGIKA LIST & CHART (Ringkasan)
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

function renderSalesList(data) {
    const el = document.getElementById('list-salesman');
    if (!el) return;
    const salesData = {};
    data.forEach(d => {
        const name = d.salesman_name || 'NO NAME';
        salesData[name] = (salesData[name] || 0) + (Number(d.os_balance) || 0);
    });
    const sorted = Object.entries(salesData).sort((a, b) => b[1] - a[1]).slice(0, 5);
    el.innerHTML = sorted.map(([name, val]) => `
        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 pb-2">
            <span class="font-black text-[#1B2559] uppercase truncate w-24">${name}</span>
            <span class="font-bold">${formatIDR(val)}</span>
        </div>`).join('');
}

function renderOverdueList(data) {
    const el = document.getElementById('list-overdue');
    if (!el) return;
    const sorted = data.filter(d => (Number(d.total_overd) || 0) > 0).sort((a, b) => b.total_overd - a.total_overd).slice(0, 5);
    el.innerHTML = sorted.map(d => `
        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 pb-2">
            <span class="font-black text-red-600 uppercase truncate w-24">${d.customer_name}</span>
            <span class="font-bold">${formatIDR(d.total_overd)}</span>
        </div>`).join('');
}

function renderTopSPV(data, totalOS) {
    const el = document.getElementById('list-spv');
    if (!el) return;
    const spvData = {};
    data.forEach(d => {
        const name = d.supervisor_name || 'NO NAME';
        spvData[name] = (spvData[name] || 0) + (Number(d.os_balance) || 0);
    });
    const sorted = Object.entries(spvData).sort((a, b) => b[1] - a[1]).slice(0, 5);
    el.innerHTML = sorted.map(([name, val]) => `
        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 pb-2">
            <span class="font-black text-[#1B2559] uppercase truncate w-24">${name}</span>
            <span class="font-bold text-blue-600">${((val / totalOS) * 100).toFixed(1)}%</span>
        </div>`).join('');
}

// 7. INITIALIZATION & TAB NAVIGATION
function initTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const sections = {
        ringkasan: document.getElementById('ringkasan-section'),
        leasing: document.getElementById('leasing-section'),
        overdue: document.getElementById('overdue-section'),
        database: document.getElementById('database-section')
    };

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            Object.values(sections).forEach(sec => sec.classList.add('hidden'));
            if (sections[target]) sections[target].classList.remove('hidden');
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