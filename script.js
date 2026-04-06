import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Instance Chart agar bisa di-update/destroy jika perlu
let donutChart, barChart;

function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')} WIB`;
    document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${dateStr} - ${timeStr}`;
    document.getElementById('arsip-db-text').innerText = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;

        document.getElementById('db-status-dot').className = "w-2 h-2 rounded-full bg-emerald-500";
        document.getElementById('db-status-text').innerText = "Status: Terhubung (Realtime)";
        
        processData(data);
    } catch (err) {
        console.error(err);
        document.getElementById('db-status-dot').className = "w-2 h-2 rounded-full bg-red-600";
        document.getElementById('db-status-text').innerText = "Status: Gagal Sinkronisasi!";
    }
}

function processData(data) {
    const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

    // KATEGORI DATA BERDASARKAN KOLOM ASLI SUPABASE ANDA
    const cashData = data.filter(d => String(d.leasing_name || '').toUpperCase() === 'CASH');
    const leasingData = data.filter(d => String(d.leasing_name || '').toUpperCase() !== 'CASH');
    const overdueData = data.filter(d => (Number(d.total_overdue) || 0) > 0);

    const totalCash = cashData.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const totalLeasing = leasingData.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const totalOS = totalCash + totalLeasing;
    const totalOverdue = overdueData.reduce((sum, d) => sum + (Number(d.total_overdue) || 0), 0);

    // Update Card UI
    document.getElementById('total-os').innerText = formatIDR(totalOS);
    document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
    document.getElementById('count-overdue').innerText = `${overdueData.length} UNIT TERLAMBAT`;
    document.getElementById('val-cash').innerText = formatIDR(totalCash);
    document.getElementById('unit-cash').innerText = `${cashData.length} UNIT`;
    document.getElementById('val-leasing').innerText = formatIDR(totalLeasing);
    document.getElementById('unit-leasing').innerText = `${leasingData.length} UNIT`;

    // Progress Bar
    if(totalOS > 0) {
        document.getElementById('bar-cash').style.width = (totalCash / totalOS * 100) + "%";
        document.getElementById('bar-leasing').style.width = (totalLeasing / totalOS * 100) + "%";
    }

    // AGING BUCKETS (Menggunakan kolom 'hari_overdue' atau 'status_aging')
    const agingBuckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    data.forEach(d => {
        const status = String(d.status_aging || '').toUpperCase();
        const os = Number(d.os_balance) || 0;
        
        if (status.includes("BELUM") || status.includes("LANCAR")) agingBuckets['LANCAR'] += os;
        else if (status.includes("1-30")) agingBuckets['1-30 H'] += os;
        else if (status.includes("31-60")) agingBuckets['31-60 H'] += os;
        else agingBuckets['>60 H'] += os;
    });

    renderCharts(cashData.length, leasingData.length, Object.values(agingBuckets));
}

function renderCharts(cashUnit, leasingUnit, agingValues) {
    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    // Donut Chart (Berdasarkan Jumlah Unit)
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cashUnit, leasingUnit],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 280 },
        colors: ['#10B981', '#3B82F6'],
        plotOptions: { pie: { donut: { size: '75%', labels: { show: true, total: { show: true, label: 'TOTAL UNIT', formatter: () => cashUnit + leasingUnit } } } } },
        dataLabels: { enabled: false }
    });
    donutChart.render();

    // Bar Chart (Aging berdasarkan Nominal OS)
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal O/S', data: agingValues }],
        chart: { type: 'bar', height: 280, toolbar: { show: false } },
        colors: ['#6366F1'],
        plotOptions: { bar: { borderRadius: 8, columnWidth: '50%', distributed: true } },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] },
        yaxis: { labels: { formatter: (v) => 'Rp ' + (v/1000000).toFixed(0) + ' Jt' } },
        legend: { show: false }
    });
    barChart.render();
}

updateDateTime();
loadData();
setInterval(updateDateTime, 60000);