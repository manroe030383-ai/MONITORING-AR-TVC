import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Supabase (Tetap gunakan kredensial Anda)
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let donutChart, barChart;

// 2. Sinkronisasi Waktu Real-time
function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    
    document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')} WIB`;
    document.getElementById('arsip-db-text').innerText = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

// 3. Fungsi Load Data Utama
async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;

        if (data) {
            console.log("Data Berhasil Ditarik:", data.length, "Baris");
            processData(data);
        }
    } catch (err) {
        console.error("Gagal menarik data:", err.message);
    }
}

// 4. Logika Pengolahan Data (KPI & List)
function processData(data) {
    const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    const formatJuta = (n) => (Number(n)/1000000).toFixed(1) + ' Jt';

    // --- HITUNG KPI UTAMA ---
    const totalOS = data.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const overdueData = data.filter(d => (Number(d.total_overdue) || 0) > 0);
    const totalOverdue = overdueData.reduce((sum, d) => sum + (Number(d.total_overdue) || 0), 0);
    const totalLancar = data.filter(d => String(d.status_aging).toUpperCase().includes("LANCAR"))
                            .reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);

    // Update Angka di Card
    document.getElementById('total-os').innerText = formatIDR(totalOS);
    document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
    document.getElementById('count-overdue').innerText = `${overdueData.length} UNIT TERLAMBAT`;
    document.getElementById('total-lancar').innerText = formatIDR(totalLancar);

    // --- AGING BUCKETS (Untuk Bar Chart) ---
    const buckets = { 'LANCAR': 0, '1-30': 0, '31-60': 0, '>60': 0 };
    data.forEach(d => {
        const aging = String(d.status_aging || '').toUpperCase();
        const val = Number(d.os_balance) || 0;
        if (aging.includes("LANCAR")) buckets['LANCAR'] += val;
        else if (aging.includes("1-30")) buckets['1-30'] += val;
        else if (aging.includes("31-60")) buckets['31-60'] += val;
        else buckets['>60'] += val;
    });

    // --- TOP SALESMAN ---
    const salesMap = {};
    data.forEach(d => {
        const name = d.salesman_name || 'NO NAME';
        if (!salesMap[name]) salesMap[name] = { nominal: 0, unit: 0 };
        salesMap[name].nominal += Number(d.os_balance) || 0;
        salesMap[name].unit += 1;
    });
    const topSales = Object.entries(salesMap).sort((a,b) => b[1].nominal - a[1].nominal).slice(0, 5);
    
    document.getElementById('list-salesman').innerHTML = topSales.map((s, i) => `
        <div class="flex justify-between items-center border-b border-slate-50 pb-2">
            <div class="flex flex-col">
                <span class="text-[10px] font-black text-[#1B2559]">${i+1}. ${s[0]}</span>
                <span class="text-[8px] text-slate-400 font-bold">${s[1].unit} UNIT</span>
            </div>
            <span class="text-[11px] font-black text-red-500">${formatJuta(s[1].nominal)}</span>
        </div>
    `).join('');

    // --- TVC BREAKDOWN (Leasing Astra) ---
    const astraLeasing = ['ACC', 'TAFS'];
    const tvcTotal = data.filter(d => astraLeasing.includes(String(d.leasing_name).toUpperCase()));
    const sudahTagih = tvcTotal.filter(d => String(d.status_tagih).toUpperCase() === 'SUDAH').length;

    document.getElementById('list-tvc').innerHTML = `
        <div class="bg-blue-50 p-4 rounded-2xl text-center mb-4 border border-blue-100">
            <p class="text-[9px] font-bold text-blue-500 uppercase">Total Unit (Leasing Astra)</p>
            <p class="text-2xl font-black text-blue-900">${tvcTotal.length} Unit</p>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-6">
            <div class="bg-emerald-50 p-3 rounded-xl text-center border border-emerald-100">
                <span class="text-[7px] font-black text-emerald-600 uppercase">SUDAH GI</span>
                <b class="text-sm block text-emerald-700">${sudahTagih}</b>
            </div>
            <div class="bg-orange-50 p-3 rounded-xl text-center border border-orange-100">
                <span class="text-[7px] font-black text-orange-600 uppercase">BELUM DELIVERY</span>
                <b class="text-sm block text-orange-700">${tvcTotal.length - sudahTagih}</b>
            </div>
        </div>
    `;

    // --- TOP OVERDUE ---
    const topOvd = data.filter(d => (Number(d.hari_overdue) || 0) > 0)
                       .sort((a, b) => b.total_overdue - a.total_overdue)
                       .slice(0, 5);

    document.getElementById('list-overdue').innerHTML = topOvd.map((d, i) => `
        <div class="flex justify-between items-start">
            <div class="flex flex-col">
                <span class="text-[9px] font-black text-[#1B2559] uppercase truncate w-32">${i+1}. ${d.customer_name}</span>
                <span class="bg-red-600 text-white text-[7px] font-black px-2 py-0.5 rounded-md mt-1 w-fit uppercase">MAX ${d.hari_overdue} HARI</span>
            </div>
            <span class="text-[10px] font-black text-red-600">${formatJuta(d.total_overdue)}</span>
        </div>
    `).join('');

    // --- TOP SPV ---
    const spvMap = {};
    data.forEach(d => {
        const name = d.supervisor_name || 'OTHERS';
        if (!spvMap[name]) spvMap[name] = { nominal: 0, unit: 0 };
        spvMap[name].nominal += Number(d.os_balance) || 0;
        spvMap[name].unit += 1;
    });
    const topSPV = Object.entries(spvMap).sort((a,b) => b[1].nominal - a[1].nominal).slice(0, 5);

    document.getElementById('list-spv').innerHTML = topSPV.map((s, i) => {
        const percentage = ((s[1].nominal / totalOS) * 100).toFixed(1);
        return `
        <div class="mb-4">
            <div class="flex justify-between mb-1">
                <span class="text-[9px] font-black text-[#1B2559] uppercase">${i+1}. ${s[0]}</span>
                <span class="text-[9px] font-black text-purple-600">${formatJuta(s[1].nominal)}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-1.5">
                <div class="bg-purple-500 h-1.5 rounded-full" style="width: ${percentage}%"></div>
            </div>
        </div>`;
    }).join('');

    renderCharts(data, Object.values(buckets));
}

// 5. Render Charts (ApexCharts)
function renderCharts(data, agingValues) {
    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    const cashCount = data.filter(d => String(d.leasing_name).toUpperCase() === 'CASH').length;
    const leasingCount = data.length - cashCount;

    // Donut Chart
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cashCount, leasingCount],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 250 },
        colors: ['#10B981', '#3B82F6'],
        legend: { position: 'bottom', fontFamily: 'Public Sans' },
        plotOptions: { pie: { donut: { size: '70%' } } }
    });
    donutChart.render();

    // Bar Chart
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal O/S', data: agingValues }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 10, columnWidth: '50%' } },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'], labels: { style: { fontSize: '9px', fontWeight: 900 } } },
        yaxis: { labels: { formatter: (v) => (v/1000000).toFixed(0) + ' Jt', style: { fontSize: '8px' } } },
        dataLabels: { enabled: false }
    });
    barChart.render();
}

// Inisialisasi
updateDateTime();
loadData();
setInterval(updateDateTime, 60000);