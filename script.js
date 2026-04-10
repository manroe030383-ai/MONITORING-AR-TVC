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

// 3. Load Data
async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) processData(data);
    } catch (err) {
        console.error("Gagal menarik data:", err.message);
    }
}

// 4. Logika Pengolahan Data (KPI & Aging)
function processData(data) {
    const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    
    // KPI Utama
    const totalOS = data.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const overdueData = data.filter(d => (Number(d.total_overdue) || 0) > 0);
    const totalOverdue = overdueData.reduce((sum, d) => sum + (Number(d.total_overdue) || 0), 0);
    const totalLancar = data.filter(d => String(d.status_aging || '').toUpperCase().includes("LANCAR"))
                            .reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);

    document.getElementById('total-os').innerText = formatIDR(totalOS);
    document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
    document.getElementById('count-overdue').innerText = `${overdueData.length} UNIT TERLAMBAT`;
    document.getElementById('total-lancar').innerText = formatIDR(totalLancar);

    // --- PERBAIKAN LOGIKA AGING (Agar Distribusi Merata) ---
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    data.forEach(d => {
        const agingStr = String(d.status_aging || '').toUpperCase();
        const val = (Number(d.os_balance) || 0) / 1000000; // Konversi ke Juta
        
        if (agingStr.includes("LANCAR")) buckets['LANCAR'] += val;
        else if (agingStr.includes("1-30") || agingStr.includes("1 - 30")) buckets['1-30 H'] += val;
        else if (agingStr.includes("31-60") || agingStr.includes("31 - 60")) buckets['31-60 H'] += val;
        else if (agingStr.includes(">60") || agingStr.includes("Diatas 60")) buckets['>60 H'] += val;
    });

    // --- KOMPOSISI CASH VS LEASING ---
    const cashArr = data.filter(d => String(d.leasing_name || '').toUpperCase() === 'CASH');
    const leasingArr = data.filter(d => String(d.leasing_name || '').toUpperCase() !== 'CASH');
    
    const cashNominal = cashArr.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const leasingNominal = leasingArr.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);

    // Update Info Cards (Samping Donut)
    document.getElementById('val-total-cash').innerText = formatIDR(cashNominal);
    document.getElementById('unit-cash').innerText = `${cashArr.length} Unit`;
    document.getElementById('pct-cash').innerText = ((cashNominal / totalOS) * 100).toFixed(1) + '%';

    document.getElementById('val-total-leasing').innerText = formatIDR(leasingNominal);
    document.getElementById('unit-leasing').innerText = `${leasingArr.length} Unit`;
    document.getElementById('pct-leasing').innerText = ((leasingNominal / totalOS) * 100).toFixed(1) + '%';

    // --- TOP LEASING BREAKDOWN (Bar Samping) ---
    const leasingSummary = {};
    leasingArr.forEach(d => {
        const name = (d.leasing_name || 'OTHERS').toUpperCase();
        leasingSummary[name] = (leasingSummary[name] || 0) + (Number(d.os_balance) || 0);
    });

    const sortedLeasing = Object.entries(leasingSummary).sort((a,b) => b[1] - a[1]).slice(0, 3);
    document.getElementById('leasing-bars').innerHTML = sortedLeasing.map(([name, val]) => {
        const pct = ((val / totalOS) * 100).toFixed(1);
        return `
            <div class="mb-4">
                <div class="flex justify-between text-[10px] mb-1 font-black">
                    <span class="text-[#1B2559] uppercase">${name}</span>
                    <span class="text-slate-400">${pct}% <b class="text-[#1B2559] ml-2">${(val/1000000).toFixed(1)} Jt</b></span>
                </div>
                <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-[#422AFB] h-full rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>`;
    }).join('');

    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
    renderOtherLists(data, totalOS);
}

// 5. Render Charts (ApexCharts) - DISESUAIKAN PERSIS REFERENSI
function renderCharts(cashVal, leasingVal, agingData) {
    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    // Donut Chart
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cashVal, leasingVal],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 250, fontFamily: 'Public Sans' },
        colors: ['#10B981', '#3B82F6'],
        stroke: { show: true, width: 2, colors: ['#fff'] },
        plotOptions: { pie: { donut: { size: '75%' } } },
        legend: { show: false },
        dataLabels: { enabled: true, formatter: (val) => val.toFixed(1) + '%' }
    });
    donutChart.render();

    // Bar Chart (Aging Analysis)
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal O/S', data: agingData }],
        chart: { type: 'bar', height: 350, toolbar: { show: false }, fontFamily: 'Public Sans' },
        colors: ['#10B981', '#FFD700', '#FF8C00', '#EF4444'], // Hijau, Kuning, Oranye, Merah
        plotOptions: { 
            bar: { 
                distributed: true, 
                borderRadius: 8, 
                columnWidth: '60%',
                dataLabels: { position: 'top' } 
            } 
        },
        xaxis: { 
            categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'],
            labels: { style: { fontSize: '10px', fontWeight: 900 } }
        },
        yaxis: { labels: { formatter: (v) => v.toFixed(0) + ' Jt' } },
        dataLabels: { 
            enabled: true, 
            offsetY: -20, 
            formatter: (v) => v > 0 ? v.toFixed(1) + ' Jt' : '',
            style: { fontSize: '10px', colors: ['#1B2559'], fontWeight: 700 }
        },
        grid: { strokeDashArray: 4 },
        legend: { show: false }
    });
    barChart.render();
}

// 6. Fungsi Render List Lainnya (Salesman, Overdue, SPV)
function renderOtherLists(data, totalOS) {
    const formatJuta = (n) => (Number(n)/1000000).toFixed(1) + ' Jt';

    // Top Salesman
    const sMap = {};
    data.forEach(d => {
        const n = d.salesman_name || 'UNKNOWN';
        sMap[n] = (sMap[n] || 0) + (Number(d.os_balance) || 0);
    });
    const topS = Object.entries(sMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('list-salesman').innerHTML = topS.map((s, i) => `
        <div class="flex justify-between items-center mb-4">
            <span class="text-[10px] font-black text-[#1B2559] uppercase">${i+1}. ${s[0]}</span>
            <span class="text-[10px] font-black text-blue-600">${formatJuta(s[1])}</span>
        </div>`).join('');

    // Top Overdue
    const ovd = data.filter(d => Number(d.total_overdue) > 0).sort((a,b) => b.total_overdue - a.total_overdue).slice(0, 5);
    document.getElementById('list-overdue').innerHTML = ovd.map((d, i) => `
        <div class="flex justify-between items-start mb-4">
            <div class="flex flex-col">
                <span class="text-[9px] font-black text-[#1B2559] uppercase">${i+1}. ${d.customer_name}</span>
                <span class="text-[7px] font-bold text-red-500 italic">${d.hari_overdue} HARI</span>
            </div>
            <span class="text-[10px] font-black text-red-600">${formatJuta(d.total_overdue)}</span>
        </div>`).join('');
}

// Run
updateDateTime();
loadData();
setInterval(updateDateTime, 60000);