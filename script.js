import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let donutChart, barChart;

// 1. Update Waktu & Tanggal (Sesuai Dashboard Pangkalan Bun)
function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    const timeStr = `${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')} WIB`;
    document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${dateStr} - ${timeStr}`;
    document.getElementById('arsip-db-text').innerText = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

// 2. Load Data dari Supabase (ar_unit)
async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        processData(data);
    } catch (err) {
        console.error("Gagal load data:", err);
    }
}

// 3. Logika Pengolahan Data Utama
function processData(data) {
    const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    const formatJuta = (n) => (Number(n)/1000000).toFixed(1) + ' Jt';

    const totalOS = data.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const overdueData = data.filter(d => (Number(d.total_overdue) || 0) > 0);
    const totalOverdue = overdueData.reduce((sum, d) => sum + (Number(d.total_overdue) || 0), 0);

    // Update Kartu Atas
    document.getElementById('total-os').innerText = formatIDR(totalOS);
    document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
    document.getElementById('count-overdue').innerText = `${overdueData.length} UNIT TERLAMBAT`;

    // Aging Analysis (Bucket)
    const agingValues = [0, 0, 0, 0]; 
    data.forEach(d => {
        const status = String(d.status_aging || '').toUpperCase();
        const os = Number(d.os_balance) || 0;
        if (status.includes("LANCAR")) agingValues[0] += os;
        else if (status.includes("1-30")) agingValues[1] += os;
        else if (status.includes("31-60")) agingValues[2] += os;
        else agingValues[3] += os;
    });

    renderCharts(data, agingValues);
    renderRankings(data, formatJuta, totalOS);
}

// 4. Grafik (ApexCharts)
function renderCharts(data, agingValues) {
    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    const cashUnit = data.filter(d => String(d.leasing_name).toUpperCase() === 'CASH').length;
    const leasingUnit = data.length - cashUnit;

    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cashUnit, leasingUnit],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 250 },
        colors: ['#10B981', '#3B82F6'],
        plotOptions: { pie: { donut: { size: '70%' } } },
        legend: { position: 'bottom' }
    });
    donutChart.render();

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

// 5. Ranking & Breakdown (MENIRU GAMBAR KANAN)
function renderRankings(data, formatJuta, totalGlobalOS) {
    
    // --- TOP SALESMAN (Dengan Info Unit) ---
    const salesMap = {};
    data.forEach(d => {
        const name = d.salesman_name || '-';
        if (!salesMap[name]) salesMap[name] = { nominal: 0, unit: 0 };
        salesMap[name].nominal += Number(d.os_balance || 0);
        salesMap[name].unit += 1;
    });
    const topSales = Object.entries(salesMap).sort((a,b) => b[1].nominal - a[1].nominal).slice(0, 5);

    document.getElementById('list-salesman').innerHTML = topSales.map((item, i) => `
        <div class="flex justify-between items-center border-b border-slate-50 pb-2">
            <div class="flex flex-col">
                <span class="text-[10px] font-black text-[#1B2559] uppercase"><span class="text-slate-300 mr-2">${i+1}.</span>${item[0]}</span>
                <span class="text-[8px] text-slate-400 font-bold">${item[1].unit} Unit</span>
            </div>
            <span class="text-[11px] font-black text-red-500">${formatJuta(item[1].nominal)}</span>
        </div>
    `).join('');

    // --- TVC BREAKDOWN (Astra Leasing Only) ---
    const tvcData = data.filter(d => ['ACC', 'TAFS'].includes(String(d.leasing_name).toUpperCase()));
    const sudahTagih = tvcData.filter(d => String(d.status_tagih).toUpperCase() === 'SUDAH').length;
    
    document.getElementById('list-tvc').innerHTML = `
        <div class="bg-blue-50 p-4 rounded-2xl text-center mb-4 border border-blue-100">
            <p class="text-[8px] font-bold text-blue-500 uppercase tracking-widest">Total Penjualan Leasing (TVC)</p>
            <p class="text-2xl font-black text-blue-900">${tvcData.length} Unit</p>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-6">
            <div class="bg-emerald-50 p-3 rounded-xl text-center border border-emerald-100">
                <span class="text-[7px] font-black text-emerald-600 block uppercase">Sudah GI / Tagih</span>
                <b class="text-sm text-emerald-700">${sudahTagih} Unit</b>
            </div>
            <div class="bg-orange-50 p-3 rounded-xl text-center border border-orange-100">
                <span class="text-[7px] font-black text-orange-600 block uppercase">Belum Delivery</span>
                <b class="text-sm text-orange-700">${tvcData.length - sudahTagih} Unit</b>
            </div>
        </div>
        <div class="space-y-3">
            <p class="text-[8px] font-black text-slate-400 uppercase">Tagih Sudah Dikirim / Belum Bayar</p>
            ${['ACC', 'TAFS'].map(l => {
                const count = data.filter(d => String(d.leasing_name).toUpperCase() === l).length;
                return `
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-black text-slate-700">${l}</span>
                    <span class="bg-amber-400 text-white text-[9px] px-2 py-0.5 rounded-full font-black">${count} Cust</span>
                </div>`;
            }).join('')}
        </div>
    `;

    // --- TOP OVERDUE (Urutan Hari Terlama + Label Merah) ---
    const topOvd = data.filter(d => (Number(d.total_overdue) || 0) > 0)
                       .sort((a,b) => (b.hari_overdue || 0) - (a.hari_overdue || 0))
                       .slice(0, 5);

    document.getElementById('list-overdue').innerHTML = topOvd.map((d, i) => `
        <div class="flex justify-between items-start mb-4">
            <div class="flex flex-col">
                <span class="font-black text-[#1B2559] text-[10px] uppercase truncate w-32"><span class="text-slate-300 mr-1">${i+1}.</span>${d.customer_name}</span>
                <span class="bg-red-600 text-white text-[7px] font-black px-2 py-0.5 rounded-md mt-1 w-fit">MAX ${d.hari_overdue || 0} HARI</span>
            </div>
            <div class="text-right">
                <span class="font-black text-red-600 text-[10px] block">Rp ${formatJuta(d.total_overdue)}</span>
                <span class="text-[8px] text-slate-400 font-bold">1 Unit</span>
            </div>
        </div>
    `).join('');

    // --- TOP SPV (Dengan Progress Bar Ungu) ---
    const spvMap = {};
    data.forEach(d => {
        const name = d.supervisor_name || '-';
        if (!spvMap[name]) spvMap[name] = { nominal: 0, unit: 0 };
        spvMap[name].nominal += Number(d.os_balance || 0);
        spvMap[name].unit += 1;
    });
    const topSPV = Object.entries(spvMap).sort((a,b) => b[1].nominal - a[1].nominal).slice(0, 5);

    document.getElementById('list-spv').innerHTML = topSPV.map((item, i) => {
        const percent = ((item[1].nominal / totalGlobalOS) * 100).toFixed(1);
        return `
        <div class="mb-4">
            <div class="flex justify-between items-center mb-1">
                <span class="text-[10px] font-black text-[#1B2559] uppercase"><span class="text-slate-300 mr-1">${i+1}.</span>${item[0]}</span>
                <span class="text-[10px] font-black text-purple-600">${formatJuta(item[1].nominal)}</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-1.5 mb-1">
                <div class="bg-purple-500 h-1.5 rounded-full" style="width: ${percent}%"></div>
            </div>
            <div class="flex justify-between text-[7px] font-bold text-slate-400 uppercase">
                <span>${percent}% Global</span>
                <span>${item[1].unit} Unit</span>
            </div>
        </div>`;
    }).join('');
}

// Inisialisasi
updateDateTime();
loadData();
setInterval(updateDateTime, 60000);