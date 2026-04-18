import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let donutChart = null, barChart = null;

// 1. FORMATTER & UTILITY
const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
function updateText(id, value) { const el = document.getElementById(id); if (el) el.innerText = value; }

function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    updateText('tgl-update-text', `DATA UPDATE: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${time} WIB`);
}

// 2. NAVIGASI TAB (Fungsi agar tombol bisa diklik)
window.showSection = function(sectionId) {
    // Sembunyikan semua section
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    // Tampilkan yang dipilih
    const target = document.getElementById(`${sectionId}-section`);
    if (target) target.classList.remove('hidden');

    // Update style tombol
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-tab="${sectionId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
};

// 3. LOAD DATA UTAMA
async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) {
            processDashboard(data);
            renderDetailedTables(data);
            
            // Ambil tanggal arsip dari database
            if (data[0] && data[0].created_at) {
                const d = new Date(data[0].created_at);
                updateText('tgl-arsip', `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`);
            }
        }
    } catch (err) { console.error("Error load data:", err.message); }
}

// 4. LOGIKA PERHITUNGAN ANGKA (Sesuai Kolom Database)
function processDashboard(data) {
    let totalOS = 0, totalOverdue = 0, totalPenalty = 0;
    let cashNominal = 0, leasingNominal = 0;
    let unitSudahGI = 0, unitRDelivery = 0, unitLeasingCount = 0;
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        const os = parseFloat(d.os_balance) || 0;
        const overdue = parseFloat(d.total_overd) || 0;
        const penalty = parseFloat(d.penalty_amount) || 0;
        const age = parseInt(d.hari_overdue) || 0;
        const type = (d.leasing_name || '').toUpperCase().trim();

        totalOS += os;
        totalOverdue += overdue;
        totalPenalty += penalty;

        // Distribusi Aging (Bar Chart)
        if (age <= 0) buckets['LANCAR'] += os;
        else if (age <= 30) buckets['1-30 H'] += os;
        else if (age <= 60) buckets['31-60 H'] += os;
        else buckets['>60 H'] += os;

        // Distribusi Cash vs Leasing
        if (type === "CASH" || type === "") {
            cashNominal += os;
        } else {
            leasingNominal += os;
            unitLeasingCount++;
            if (d.gl_date && d.gl_date !== "0" && d.gl_date !== "-") unitSudahGI++; 
            else unitRDelivery++;
        }
    });

    // Update Kartu Utama
    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdue));
    updateText('total-penalty', formatIDR(totalPenalty));
    updateText('total-lancar', formatIDR(totalOS - totalOverdue)); // Belum Jatuh Tempo

    // Badge SPK Overdue
    const overdueCount = data.filter(x => (parseFloat(x.total_overd) || 0) > 0).length;
    updateText('count-overdue-spk', `${overdueCount} SPK LEWAT TOP`);

    // Update Info Leasing
    updateText('total-penjualan-leasing', unitLeasingCount + " Unit");
    updateText('unit-sudah-gi', unitSudahGI);
    updateText('unit-r-delivery', unitRDelivery);
    updateText('val-total-cash', formatIDR(cashNominal));
    updateText('val-total-leasing', formatIDR(leasingNominal));

    // Progress Bar
    const bCash = document.getElementById('bar-cash');
    const bLeasing = document.getElementById('bar-leasing');
    if (totalOS > 0) {
        if (bCash) bCash.style.width = `${(cashNominal / totalOS) * 100}%`;
        if (bLeasing) bLeasing.style.width = `${(leasingNominal / totalOS) * 100}%`;
    }

    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
    renderSideLists(data, totalOS);
}

// 5. RENDER TABEL (Detailed View)
function renderDetailedTables(data) {
    const leasingBody = document.getElementById('leasing-table-body');
    const overdueBody = document.getElementById('overdue-table-body');
    const dbBody = document.getElementById('database-table-body');

    if (leasingBody) {
        leasingBody.innerHTML = data.filter(d => d.leasing_name?.toUpperCase() !== 'CASH').map(d => `
            <tr class="border-b border-slate-50 hover:bg-slate-50">
                <td class="p-4"><span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[9px] font-black">${d.leasing_name}</span></td>
                <td class="p-4 font-black text-[#1B2559] uppercase">${d.customer_name}</td>
                <td class="p-4"><b>${d.salesman_name}</b></td>
                <td class="p-4 text-center">${d.gl_date || '-'}</td>
                <td class="p-4 text-right font-black">${formatIDR(d.os_balance)}</td>
            </tr>`).join('');
    }

    if (overdueBody) {
        overdueBody.innerHTML = data.filter(d => (parseFloat(d.total_overd) || 0) > 0).map(d => `
            <tr class="border-b border-red-50 hover:bg-red-50/30">
                <td class="p-4"><span class="bg-red-50 text-red-600 px-2 py-1 rounded-full font-black">${d.hari_overdue} HR</span></td>
                <td class="p-4 font-black text-[#1B2559] uppercase">${d.customer_name}</td>
                <td class="p-4 text-right font-black text-red-600">${formatIDR(d.total_overd)}</td>
            </tr>`).join('');
    }

    if (dbBody) {
        updateText('total-row-db', `${data.length} RECORDS`);
        dbBody.innerHTML = data.map((d, i) => `
            <tr class="border-b border-slate-50 hover:bg-blue-50/20">
                <td class="p-3 text-slate-400 font-bold">${i+1}</td>
                <td class="p-3 font-bold uppercase text-[#1B2559]">${d.customer_name}</td>
                <td class="p-3 text-right font-black">${formatIDR(d.os_balance)}</td>
                <td class="p-3 text-center">${d.hari_overdue}</td>
            </tr>`).join('');
    }
}

// 6. RENDER CHARTS
function renderCharts(cash, leasing, agingValues) {
    if (donutChart) donutChart.destroy();
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cash, leasing], labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 250 }, colors: ['#10B981', '#2563EB'],
        plotOptions: { pie: { donut: { size: '70%' } } }, legend: { position: 'bottom' }
    });
    donutChart.render();

    if (barChart) barChart.destroy();
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal', data: agingValues.map(v => v / 1000000) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 6 } },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] },
        yaxis: { labels: { formatter: (v) => v.toFixed(0) + 'jt' } }
    });
    barChart.render();
}

// 7. RENDER SIDEBAR LISTS
function renderSideLists(data, total) {
    // Top Salesman
    const salesRes = {};
    data.forEach(d => salesRes[d.salesman_name] = (salesRes[d.salesman_name] || 0) + Number(d.os_balance));
    const sortedSales = Object.entries(salesRes).sort((a,b) => b[1]-a[1]).slice(0, 5);
    document.getElementById('list-salesman').innerHTML = sortedSales.map(([k,v]) => `
        <div class="flex justify-between items-center text-[10px] pb-2 border-b border-slate-50">
            <span class="font-black text-[#1B2559] uppercase">${k}</span>
            <span class="font-bold">${formatIDR(v)}</span>
        </div>`).join('');

    // Top SPV
    const spvRes = {};
    data.forEach(d => spvRes[d.supervisor_name] = (spvRes[d.supervisor_name] || 0) + Number(d.os_balance));
    const sortedSPV = Object.entries(spvRes).sort((a,b) => b[1]-a[1]).slice(0, 5);
    document.getElementById('list-spv').innerHTML = sortedSPV.map(([k,v]) => `
        <div class="flex justify-between items-center text-[10px] pb-2 border-b border-slate-50">
            <span class="font-black text-[#1B2559] uppercase">${k}</span>
            <span class="font-bold text-blue-600">${((v/total)*100).toFixed(1)}%</span>
        </div>`).join('');
}

// 8. EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    loadData();
    
    // Klik Tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            window.showSection(tabId);
        });
    });

    setInterval(updateDateTime, 60000);
    setInterval(loadData, 300000);
});// Auto refresh data setiap 5 menit