import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let donutChart, barChart;

// 2. Sinkronisasi Waktu Real-time
function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    
    // Pastikan ID 'tgl-update-text' dan 'arsip-db-text' ada di HTML Anda
    if(document.getElementById('tgl-update-text')) {
        document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')} WIB`;
    }
    if(document.getElementById('arsip-db-text')) {
        document.getElementById('arsip-db-text').innerText = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    }
}

// 3. Fungsi Utama Load Data
async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) {
            console.log("Data loaded:", data.length);
            processData(data);
        }
    } catch (err) {
        console.error("Gagal menarik data:", err.message);
    }
}

// 4. Logika Pengolahan Data & Inject ke UI
function processData(data) {
    const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    const formatJuta = (n) => (Number(n)/1000000).toFixed(1) + ' Jt';

    // --- KPI CARDS (BAGIAN ATAS) ---
    const totalOS = data.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const overdueData = data.filter(d => (Number(d.total_overdue) || 0) > 0);
    const totalOverdue = overdueData.reduce((sum, d) => sum + (Number(d.total_overdue) || 0), 0);
    const totalLancar = data.filter(d => String(d.status_aging || '').toUpperCase().includes("LANCAR"))
                            .reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);

    // Mengisi Card Atas
    document.getElementById('total-os').innerText = formatIDR(totalOS);
    document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
    document.getElementById('count-overdue').innerText = `${overdueData.length} UNIT TERLAMBAT`;
    document.getElementById('total-lancar').innerText = formatIDR(totalLancar);

    // --- AGING BUCKETS (FOR BAR CHART) ---
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    data.forEach(d => {
        const aging = String(d.status_aging || '').toUpperCase();
        const val = (Number(d.os_balance) || 0) / 1000000;
        if (aging.includes("LANCAR")) buckets['LANCAR'] += val;
        else if (aging.includes("1-30") || aging.includes("1-30 H")) buckets['1-30 H'] += val;
        else if (aging.includes("31-60") || aging.includes("31-60 H")) buckets['31-60 H'] += val;
        else buckets['>60 H'] += val;
    });

    // --- KOMPOSISI CASH VS LEASING (DATA DONUT & SIDE CARDS) ---
    const cashArr = data.filter(d => String(d.leasing_name || '').toUpperCase() === 'CASH');
    const leasingArr = data.filter(d => String(d.leasing_name || '').toUpperCase() !== 'CASH');
    
    const cashNominal = cashArr.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const leasingNominal = leasingArr.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);

    // Inject ke Card di sebelah Donut
    document.getElementById('val-total-cash').innerText = formatIDR(cashNominal);
    document.getElementById('unit-cash').innerText = `${cashArr.length} Unit`;
    document.getElementById('pct-cash').innerText = totalOS > 0 ? ((cashNominal / totalOS) * 100).toFixed(1) + '%' : '0%';

    document.getElementById('val-total-leasing').innerText = formatIDR(leasingNominal);
    document.getElementById('unit-leasing').innerText = `${leasingArr.length} Unit`;
    document.getElementById('pct-leasing').innerText = totalOS > 0 ? ((leasingNominal / totalOS) * 100).toFixed(1) + '%' : '0%';

    // --- LEASING BREAKDOWN (PROGRESS BARS) ---
    const leasingMap = {};
    leasingArr.forEach(d => {
        const name = (d.leasing_name || 'OTHERS').toUpperCase();
        leasingMap[name] = (leasingMap[name] || 0) + (Number(d.os_balance) || 0);
    });

    const sortedLeasing = Object.entries(leasingMap).sort((a,b) => b[1] - a[1]);
    const breakdownHtml = sortedLeasing.map(([name, val]) => {
        const pct = totalOS > 0 ? ((val / totalOS) * 100).toFixed(1) : 0;
        return `
            <div class="mb-4">
                <div class="flex justify-between text-[10px] mb-1 font-black">
                    <span class="text-[#1B2559] uppercase">${name}</span>
                    <span class="text-slate-400 font-bold">${pct}% <b class="text-[#1B2559] ml-2">${(val/1000000).toFixed(1)} Jt</b></span>
                </div>
                <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-[#422AFB] h-full rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>`;
    }).join('');
    document.getElementById('leasing-bars').innerHTML = breakdownHtml;

    // --- LIST SALESMAN & LIST OVERDUE ---
    renderLists(data);

    // --- TRIGGER CHARTS ---
    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
}

// 5. Fungsi Render List (Salesman, Overdue, SPV)
function renderLists(data) {
    const formatJuta = (n) => (Number(n)/1000000).toFixed(1) + ' Jt';

    // Salesman List
    const salesMap = {};
    data.forEach(d => {
        const name = d.salesman_name || 'NO NAME';
        if (!salesMap[name]) salesMap[name] = { nominal: 0, unit: 0 };
        salesMap[name].nominal += Number(d.os_balance) || 0;
        salesMap[name].unit += 1;
    });
    const topSales = Object.entries(salesMap).sort((a,b) => b[1].nominal - a[1].nominal).slice(0, 5);
    document.getElementById('list-salesman').innerHTML = topSales.map((s, i) => `
        <div class="flex justify-between items-center border-b border-slate-50 pb-2 mb-2">
            <div class="flex flex-col">
                <span class="text-[10px] font-black text-[#1B2559] uppercase">${i+1}. ${s[0]}</span>
                <span class="text-[8px] text-slate-400 font-bold">${s[1].unit} UNIT</span>
            </div>
            <span class="text-[11px] font-black text-red-500">${formatJuta(s[1].nominal)}</span>
        </div>`).join('');

    // Top Overdue List
    const topOvd = data.filter(d => (Number(d.total_overdue) || 0) > 0)
                       .sort((a, b) => b.total_overdue - a.total_overdue)
                       .slice(0, 5);
    document.getElementById('list-overdue').innerHTML = topOvd.map((d, i) => `
        <div class="flex justify-between items-start mb-4">
            <div class="flex flex-col">
                <span class="text-[9px] font-black text-[#1B2559] uppercase truncate w-32">${i+1}. ${d.customer_name}</span>
                <span class="bg-red-600 text-white text-[7px] font-black px-2 py-0.5 rounded-md mt-1 w-fit uppercase">MAX ${d.hari_overdue} HARI</span>
            </div>
            <span class="text-[10px] font-black text-red-600">${formatJuta(d.total_overdue)}</span>
        </div>`).join('');
}

// 6. Render Charts (ApexCharts)
function renderCharts(cashVal, leasingVal, agingValues) {
    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    // Donut Chart (Komposisi)
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cashVal, leasingVal],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 220, fontFamily: 'Public Sans' },
        colors: ['#10B981', '#422AFB'],
        plotOptions: { pie: { donut: { size: '75%' } } },
        legend: { show: false },
        dataLabels: { enabled: true, formatter: (val) => val.toFixed(1) + '%' }
    });
    donutChart.render();

    // Bar Chart (Aging Analysis)
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal O/S', data: agingValues }],
        chart: { type: 'bar', height: 350, toolbar: { show: false }, fontFamily: 'Public Sans' },
        colors: ['#10B981', '#FFD700', '#FF8C00', '#EF4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 10, columnWidth: '55%', dataLabels: { position: 'top' } } },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'], labels: { style: { fontWeight: 900, fontSize: '10px' } } },
        dataLabels: { enabled: true, offsetY: -20, formatter: (v) => v > 0 ? v.toFixed(1) + ' Jt' : '', style: { colors: ['#1B2559'], fontSize: '10px' } },
        legend: { show: false }
    });
    barChart.render();
}

// Inisialisasi awal
updateDateTime();
loadData();
setInterval(updateDateTime, 60000);