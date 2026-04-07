import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Konfigurasi Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let donutChart, barChart;

// 1. Update Waktu Secara Realtime
function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')} WIB`;
    
    const tglUpdate = document.getElementById('tgl-update-text');
    const arsipDb = document.getElementById('arsip-db-text');
    
    if(tglUpdate) tglUpdate.innerText = `DATA UPDATE: ${dateStr} - ${timeStr}`;
    if(arsipDb) arsipDb.innerText = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

// 2. Fungsi Utama Ambil Data
async function loadData() {
    try {
        // Pastikan nama tabel adalah 'ar_unit'
        const { data, error } = await supabase
            .from('ar_unit')
            .select('*');

        if (error) throw error;

        if (data) {
            console.log("Data berhasil ditarik:", data.length, "baris");
            processData(data);
        }
    } catch (err) {
        console.error("Gagal load data dari Supabase:", err.message);
        alert("Gagal menarik data! Pastikan koneksi internet aktif dan tabel 'ar_unit' tersedia.");
    }
}

// 3. Logika Pengolahan Data
function processData(data) {
    const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    const formatJuta = (n) => (Number(n)/1000000).toFixed(1) + ' Jt';

    // Kalkulasi KPI Utama
    const totalOS = data.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const overdueData = data.filter(d => (Number(d.total_overdue) || 0) > 0);
    const totalOverdue = overdueData.reduce((sum, d) => sum + (Number(d.total_overdue) || 0), 0);
    
    const lancarData = data.filter(d => String(d.status_aging).toUpperCase().includes("LANCAR"));
    const totalLancar = lancarData.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);

    // Update Elemen HTML
    document.getElementById('total-os').innerText = formatIDR(totalOS);
    document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
    document.getElementById('count-overdue').innerText = `${overdueData.length} UNIT TERLAMBAT`;
    document.getElementById('total-lancar').innerText = formatIDR(totalLancar);

    // Data untuk Aging Bar Chart
    const agingBuckets = { 'LANCAR': 0, '1-30': 0, '31-60': 0, '>60': 0 };
    data.forEach(d => {
        const s = String(d.status_aging || '').toUpperCase();
        const os = Number(d.os_balance) || 0;
        if (s.includes("LANCAR")) agingBuckets['LANCAR'] += os;
        else if (s.includes("1-30")) agingBuckets['1-30'] += os;
        else if (s.includes("31-60")) agingBuckets['31-60'] += os;
        else agingBuckets['>60'] += os;
    });

    renderCharts(data, Object.values(agingBuckets));
    renderRankings(data, formatJuta, totalOS);
}

// 4. Render Visual (Charts)
function renderCharts(data, agingValues) {
    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    const cashUnit = data.filter(d => String(d.leasing_name).toUpperCase() === 'CASH').length;
    const leasingUnit = data.length - cashUnit;

    // Donut Chart
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cashUnit, leasingUnit],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 250 },
        colors: ['#10B981', '#3B82F6'],
        legend: { position: 'bottom' }
    });
    donutChart.render();

    // Bar Chart
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal O/S', data: agingValues }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 8 } },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] },
        yaxis: { labels: { formatter: (v) => (v/1000000).toFixed(0) + ' Jt' } }
    });
    barChart.render();
}

// 5. Render Daftar Ranking & Breakdown
function renderRankings(data, formatJuta, totalGlobalOS) {
    
    // --- TOP SALESMAN ---
    const salesMap = {};
    data.forEach(d => {
        const name = d.salesman_name || '-';
        if (!salesMap[name]) salesMap[name] = { nominal: 0, unit: 0 };
        salesMap[name].nominal += Number(d.os_balance || 0);
        salesMap[name].unit += 1;
    });
    const topSales = Object.entries(salesMap).sort((a,b) => b[1].nominal - a[1].nominal).slice(0, 5);

    document.getElementById('list-salesman').innerHTML = topSales.map((item, i) => `
        <div class="flex justify-between items-start border-b border-slate-50 pb-2">
            <span class="text-[10px] font-black text-[#1B2559] uppercase"><span class="text-slate-300 mr-2">${i+1}.</span>${item[0]}</span>
            <div class="text-right flex flex-col">
                <span class="text-[11px] font-black text-red-500">${formatJuta(item[1].nominal)}</span>
                <span class="text-[8px] text-slate-400 font-bold uppercase">${item[1].unit} Unit</span>
            </div>
        </div>
    `).join('');

    // --- TVC BREAKDOWN ---
    const astraLeasing = ['ACC', 'TAFS'];
    const tvcData = data.filter(d => astraLeasing.includes(String(d.leasing_name).toUpperCase()));
    const sudahTagih = tvcData.filter(d => String(d.status_tagih).toUpperCase() === 'SUDAH').length;
    
    document.getElementById('list-tvc').innerHTML = `
        <div class="bg-blue-50 p-4 rounded-2xl text-center mb-4 border border-blue-100">
            <p class="text-[8px] font-bold text-blue-500 uppercase">Total TVC (Leasing Astra)</p>
            <p class="text-2xl font-black text-blue-900">${tvcData.length} Unit</p>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-6">
            <div class="bg-emerald-50 p-3 rounded-xl text-center border border-emerald-100">
                <span class="text-[7px] font-black text-emerald-600 uppercase">Sudah GI</span>
                <b class="text-sm text-emerald-700">${sudahTagih} Unit</b>
            </div>
            <div class="bg-orange-50 p-3 rounded-xl text-center border border-orange-100">
                <span class="text-[7px] font-black text-orange-600 uppercase">Blm Delivery</span>
                <b class="text-sm text-orange-700">${tvcData.length - sudahTagih} Unit</b>
            </div>
        </div>
    `;

    // --- TOP OVERDUE ---
    const topOvd = data.filter(d => (Number(d.hari_overdue) || 0) > 0)
                       .sort((a,b) => (b.hari_overdue || 0) - (a.hari_overdue || 0))
                       .slice(0, 5);

    document.getElementById('list-overdue').innerHTML = topOvd.map((d, i) => `
        <div class="flex justify-between items-start mb-4">