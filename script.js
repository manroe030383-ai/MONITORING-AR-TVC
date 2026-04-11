const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const _supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_KEY);

const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
const toJuta = (val) => (val / 1000000).toFixed(1);

async function loadDashboard() {
    try {
        const { data, error } = await _supabase.from('ar_unit').select('*');
        if (error) throw error;

        // --- A. AGREGASI (NAMA KOLOM SESUAI SCREENSHOT DB) ---
        // Di DB Anda: nominal_os, overdue_days, salesman_name, leasing_name
        const totalOS = data.reduce((acc, d) => acc + (Number(d.nominal_os) || 0), 0);
        const overdueData = data.filter(d => (Number(d.overdue_days) || 0) > 0);
        const totalOverdue = overdueData.reduce((acc, d) => acc + (Number(d.nominal_os) || 0), 0);
        const totalLancar = totalOS - totalOverdue;

        // --- B. UPDATE STATS CARD ---
        document.getElementById('total-os').innerText = formatIDR(totalOS);
        document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
        document.getElementById('total-lancar').innerText = formatIDR(totalLancar);
        document.getElementById('count-overdue').innerText = `${overdueData.length} SPK Lewat TOP`;

        // --- C. PAYMENT COMPOSITION ---
        const cashList = data.filter(d => d.leasing_name?.toUpperCase() === 'CASH');
        const leasingList = data.filter(d => d.leasing_name?.toUpperCase() !== 'CASH');
        const sumCash = cashList.reduce((acc, d) => acc + (Number(d.nominal_os) || 0), 0);
        const sumLeasing = leasingList.reduce((acc, d) => acc + (Number(d.nominal_os) || 0), 0);

        document.getElementById('val-total-cash').innerText = formatIDR(sumCash);
        document.getElementById('unit-cash').innerText = `${cashList.length} Unit`;
        document.getElementById('val-total-leasing').innerText = formatIDR(sumLeasing);
        document.getElementById('unit-leasing').innerText = `${leasingList.length} Unit`;

        // --- D. RENDER VISUAL ---
        renderCharts(data, sumCash, sumLeasing);
        renderLists(data, overdueData);

        // Update Timestamp
        document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;

    } catch (err) {
        console.error("Gagal load:", err.message);
    }
}

function renderCharts(data, cash, leasing) {
    // AGING Berdasarkan overdue_days
    const aging = {
        lancar: data.filter(i => (Number(i.overdue_days)||0) <= 0).reduce((a, b) => a + (Number(b.nominal_os)||0), 0),
        t1_30: data.filter(i => (Number(i.overdue_days)||0) > 0 && i.overdue_days <= 30).reduce((a, b) => a + (Number(b.nominal_os)||0), 0),
        t31_60: data.filter(i => (Number(i.overdue_days)||0) > 30 && i.overdue_days <= 60).reduce((a, b) => a + (Number(b.nominal_os)||0), 0),
        t60up: data.filter(i => (Number(i.overdue_days)||0) > 60).reduce((a, b) => a + (Number(b.nominal_os)||0), 0)
    };

    // Render Bar Aging
    new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal', data: [toJuta(aging.lancar), toJuta(aging.t1_30), toJuta(aging.t31_60), toJuta(aging.t60up)] }],
        chart: { type: 'bar', height: 250, toolbar: {show:false} },
        colors: ['#10B981', '#F59E0B', '#EF4444', '#7F1D1D'],
        xaxis: { categories: ['LANCAR', '1-30 HR', '31-60 HR', '> 60 HR'] }
    }).render();

    // Render Donut
    new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cash, leasing],
        chart: { type: 'donut', height: 200 },
        labels: ['Cash', 'Leasing'],
        colors: ['#10B981', '#422AFB'],
        legend: { position: 'bottom' }
    }).render();
}

function renderLists(data, overdueData) {
    // Top Salesman
    const salesMap = {};
    data.forEach(d => { salesMap[d.salesman_name] = (salesMap[d.salesman_name] || 0) + (Number(d.nominal_os) || 0); });
    const topSales = Object.entries(salesMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('list-salesman').innerHTML = topSales.map(([name, val], i) => `
        <div class="flex justify-between text-[10px] font-bold mb-2">
            <span>${i+1}. ${name}</span>
            <span class="text-red-500">${toJuta(val)} JT</span>
        </div>`).join('');

    // Top Overdue
    const topOverdue = overdueData.sort((a,b) => b.nominal_os - a.nominal_os).slice(0, 5);
    document.getElementById('list-overdue').innerHTML = topOverdue.map((d, i) => `
        <div class="flex justify-between text-[9px] font-bold mb-2 border-b pb-1">
            <span>${d.customer_name}</span>
            <span class="text-red-600">${toJuta(d.nominal_os)} JT</span>
        </div>`).join('');
}

document.addEventListener('DOMContentLoaded', loadDashboard);