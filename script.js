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
    
    document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')} WIB`;
    document.getElementById('arsip-db-text').innerText = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

// 3. Fungsi Load Data Utama
async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) {
            processData(data);
        }
    } catch (err) {
        console.error("Gagal menarik data:", err.message);
    }
}

// 4. Logika Pengolahan Data
function processData(data) {
    const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    const formatJuta = (n) => (Number(n)/1000000).toFixed(1) + ' Jt';

    // --- HITUNG KPI UTAMA ---
    const totalOS = data.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const overdueData = data.filter(d => (Number(d.total_overdue) || 0) > 0);
    const totalOverdue = overdueData.reduce((sum, d) => sum + (Number(d.total_overdue) || 0), 0);
    const totalLancar = data.filter(d => String(d.status_aging || '').toUpperCase().includes("LANCAR"))
                            .reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);

    document.getElementById('total-os').innerText = formatIDR(totalOS);
    document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
    document.getElementById('count-overdue').innerText = `${overdueData.length} UNIT TERLAMBAT`;
    document.getElementById('total-lancar').innerText = formatIDR(totalLancar);

    // --- AGING BUCKETS (Dalam Juta untuk Chart) ---
    const buckets = { 'LANCAR': 0, '1-30': 0, '31-60': 0, '>60': 0 };
    data.forEach(d => {
        const aging = String(d.status_aging || '').toUpperCase();
        const val = (Number(d.os_balance) || 0) / 1000000; // Konversi ke Juta
        if (aging.includes("LANCAR")) buckets['LANCAR'] += val;
        else if (aging.includes("1-30")) buckets['1-30'] += val;
        else if (aging.includes("31-60")) buckets['31-60'] += val;
        else buckets['>60'] += val;
    });

    // --- COMPOSITION DATA (Cash vs Leasing) ---
    const cashData = data.filter(d => String(d.leasing_name).toUpperCase() === 'CASH');
    const leasingData = data.filter(d => String(d.leasing_name).toUpperCase() !== 'CASH');
    
    const cashNominal = cashData.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const leasingNominal = leasingData.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    
    // Update Info Cards di sebelah Donat
    document.getElementById('val-total-cash').innerText = formatIDR(cashNominal);
    document.getElementById('unit-cash').innerText = `${cashData.length} Unit`;
    document.getElementById('pct-cash').innerText = ((cashNominal / totalOS) * 100).toFixed(1) + '%';

    document.getElementById('val-total-leasing').innerText = formatIDR(leasingNominal);
    document.getElementById('unit-leasing').innerText = `${leasingData.length} Unit`;
    document.getElementById('pct-leasing').innerText = ((leasingNominal / totalOS) * 100).toFixed(1) + '%';

    // --- LEASING BREAKDOWN (Bar memanjang ke samping) ---
    const leasingMap = {};
    leasingData.forEach(d => {
        const name = (d.leasing_name || 'OTHERS').toUpperCase();
        if (!leasingMap[name]) leasingMap[name] = 0;
        leasingMap[name] += (Number(d.os_balance) || 0);
    });

    const topLeasing = Object.entries(leasingMap)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 3); // Ambil Top 3

    document.getElementById('leasing-bars').innerHTML = topLeasing.map(([name, val]) => {
        const pct = ((val / totalOS) * 100).toFixed(1);
        return `
            <div class="mb-3">
                <div class="flex justify-between text-[11px] mb-1">
                    <span class="font-bold text-[#1B2559]">${name}</span>
                    <span class="text-slate-400 font-bold">${pct}% <b class="text-[#1B2559] ml-2">${(val/1000000).toFixed(1)} Jt</b></span>
                </div>
                <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-[#422AFB] h-full rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>`;
    }).join('');

    // --- LIST SALESMAN, TVC, OVERDUE, SPV --- (Gunakan logika lama Anda yang sudah benar)
    renderTopLists(data, totalOS);

    renderCharts(cashData.length, leasingData.length, Object.values(buckets));
}

// 5. Render Charts (ApexCharts)
function renderCharts(cashCount, leasingCount, agingValues) {
    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    // Donut Chart (Komposisi)
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cashCount, leasingCount],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 220, fontFamily: 'Public Sans' },
        colors: ['#10B981', '#422AFB'],
        stroke: { show: false },
        plotOptions: { pie: { donut: { size: '75%', labels: { show: false } } } },
        legend: { show: false },
        dataLabels: { enabled: true }
    });
    donutChart.render();

    // Bar Chart (Aging)
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal O/S', data: agingValues }],
        chart: { type: 'bar', height: 350, toolbar: { show: false }, fontFamily: 'Public Sans' },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { 
            bar: { 
                distributed: true, 
                borderRadius: 12, // Membuat batang membulat
                columnWidth: '55%',
                dataLabels: { position: 'top' }
            } 
        },
        xaxis: { 
            categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'], 
            labels: { style: { fontSize: '10px', fontWeight: 900 } },
            axisBorder: { show: false }
        },
        yaxis: { labels: { formatter: (v) => v.toFixed(0) + ' Jt', style: { fontSize: '10px' } } },
        dataLabels: { 
            enabled: true, 
            offsetY: -20, 
            formatter: (v) => v > 0 ? v.toFixed(1) + ' Jt' : '',
            style: { fontSize: '10px', colors: ['#1B2559'] }
        },
        grid: { strokeDashArray: 4 },
        legend: { show: false }
    });
    barChart.render();
}

// 6. Fungsi Helper untuk List (Agar processData tetap bersih)
function renderTopLists(data, totalOS) {
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
        <div class="flex justify-between items-center border-b border-slate-50 pb-2">
            <div class="flex flex-col">
                <span class="text-[10px] font-black text-[#1B2559]">${i+1}. ${s[0]}</span>
                <span class="text-[8px] text-slate-400 font-bold uppercase">${s[1].unit} UNIT</span>
            </div>
            <span class="text-[11px] font-black text-red-500">${formatJuta(s[1].nominal)}</span>
        </div>`).join('');

    // Overdue List
    const topOvd = data.filter(d => (Number(d.hari_overdue) || 0) > 0)
                       .sort((a, b) => (Number(b.total_overdue) || 0) - (Number(a.total_overdue) || 0))
                       .slice(0, 5);
    document.getElementById('list-overdue').innerHTML = topOvd.map((d, i) => `
        <div class="flex justify-between items-start">
            <div class="flex flex-col">
                <span class="text-[9px] font-black text-[#1B2559] uppercase truncate w-32">${i+1}. ${d.customer_name}</span>
                <span class="bg-red-600 text-white text-[7px] font-black px-2 py-0.5 rounded-md mt-1 w-fit uppercase">MAX ${d.hari_overdue} HARI</span>
            </div>
            <span class="text-[10px] font-black text-red-600">${formatJuta(d.total_overdue)}</span>
        </div>`).join('');

    // SPV List
    const spvMap = {};
    data.forEach(d => {
        const name = d.supervisor_name || 'OTHERS';
        if (!spvMap[name]) spvMap[name] = { nominal: 0 };
        spvMap[name].nominal += Number(d.os_balance) || 0;
    });
    const topSPV = Object.entries(spvMap).sort((a,b) => b[1].nominal - a[1].nominal).slice(0, 5);
    document.getElementById('list-spv').innerHTML = topSPV.map((s, i) => `
        <div class="mb-4">
            <div class="flex justify-between mb-1">
                <span class="text-[9px] font-black text-[#1B2559] uppercase">${i+1}. ${s[0]}</span>
                <span class="text-[9px] font-black text-purple-600">${formatJuta(s[1].nominal)}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div class="bg-purple-500 h-full" style="width: ${((s[1].nominal / totalOS) * 100).toFixed(1)}%"></div>
            </div>
        </div>`).join('');
}

// Inisialisasi
updateDateTime();
loadData();
setInterval(updateDateTime, 60000);