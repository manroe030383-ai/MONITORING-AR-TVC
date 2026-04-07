import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

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
        processData(data);
    } catch (err) {
        console.error(err);
    }
}

function processData(data) {
    const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    const formatJuta = (n) => (Number(n)/1000000).toFixed(1) + ' Jt';

    const cashData = data.filter(d => String(d.leasing_name || '').toUpperCase() === 'CASH');
    const leasingData = data.filter(d => String(d.leasing_name || '').toUpperCase() !== 'CASH');
    const totalOS = data.reduce((sum, d) => sum + (Number(d.os_balance) || 0), 0);
    const totalOverdue = data.reduce((sum, d) => sum + (Number(d.total_overdue) || 0), 0);

    // Update Top Cards
    document.getElementById('total-os').innerText = formatIDR(totalOS);
    document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
    document.getElementById('count-overdue').innerText = `${data.filter(d => (Number(d.total_overdue)||0) > 0).length} UNIT TERLAMBAT`;

    // AGING DATA
    const agingValues = [0, 0, 0, 0]; // Lancar, 1-30, 31-60, >60
    data.forEach(d => {
        const status = String(d.status_aging || '').toUpperCase();
        const os = Number(d.os_balance) || 0;
        if (status.includes("LANCAR")) agingValues[0] += os;
        else if (status.includes("1-30")) agingValues[1] += os;
        else if (status.includes("31-60")) agingValues[2] += os;
        else agingValues[3] += os;
    });

    renderCharts(cashData.length, leasingData.length, agingValues);
    renderRankings(data, formatJuta);
}

function renderCharts(cashUnit, leasingUnit, agingValues) {
    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cashUnit, leasingUnit],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 220 },
        colors: ['#10B981', '#3B82F6'],
        legend: { position: 'bottom' }
    });
    donutChart.render();

    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal O/S', data: agingValues }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 6 } },
        xaxis: { categories: ['LANCAR', '1-30', '31-60', '>60'] }
    });
    barChart.render();
}

function renderRankings(data, formatJuta) {
    // 1. Helper untuk Grouping (Salesman & SPV)
    const getTop = (key) => {
        const map = {};
        data.forEach(d => {
            const k = d[key] || '-';
            if (!map[k]) map[k] = { nominal: 0, unit: 0 };
            map[k].nominal += Number(d.os_balance || 0);
            map[k].unit += 1;
        });
        return Object.entries(map).sort((a,b) => b[1].nominal - a[1].nominal).slice(0, 5);
    };

    // Fill Top Salesman
    document.getElementById('list-salesman').innerHTML = getTop('salesman_name').map((item, i) => `
        <div class="flex justify-between items-center border-b border-slate-50 pb-2">
            <div class="flex flex-col">
                <span class="text-[10px] font-black text-[#1B2559] uppercase"><span class="text-slate-300 mr-1">${i+1}</span>${item[0]}</span>
                <span class="text-[8px] text-slate-400 font-bold">${item[1].unit} UNIT</span>
            </div>
            <span class="text-[11px] font-black text-red-500">${formatJuta(item[1].nominal)}</span>
        </div>
    `).join('');

    // Fill Top Supervisor
    document.getElementById('list-spv').innerHTML = getTop('supervisor_name').map((item, i) => `
        <div class="flex justify-between items-center border-b border-slate-50 pb-2">
            <div class="flex flex-col">
                <span class="text-[10px] font-black text-[#1B2559] uppercase"><span class="text-slate-300 mr-1">${i+1}</span>${item[0]}</span>
                <span class="text-[8px] text-slate-400 font-bold">${item[1].unit} UNIT</span>
            </div>
            <span class="text-[11px] font-black text-purple-600">${formatJuta(item[1].nominal)}</span>
        </div>
    `).join('');

    // 2. TVC Breakdown
    const tvcData = data.filter(d => ['ACC', 'TAFS'].includes(String(d.leasing_name).toUpperCase()));
    const sudahTagih = tvcData.filter(d => String(d.status_tagih).toUpperCase() === 'SUDAH').length;
    
    document.getElementById('list-tvc').innerHTML = `
        <div class="bg-blue-50 p-3 rounded-xl text-center mb-3">
            <p class="text-[8px] font-bold text-blue-500 uppercase">Total Penjualan Leasing (TVC)</p>
            <p class="text-xl font-black text-blue-900">${tvcData.length} Unit</p>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-4">
            <div class="bg-emerald-50 p-2 rounded-lg text-center">
                <span class="text-[7px] font-bold text-emerald-600 block uppercase">Sudah GI</span>
                <b class="text-xs text-emerald-700">${sudahTagih} Unit</b>
            </div>
            <div class="bg-orange-50 p-2 rounded-lg text-center">
                <span class="text-[7px] font-bold text-orange-600 block uppercase">Belum Delivery</span>
                <b class="text-xs text-orange-700">${tvcData.length - sudahTagih} Unit</b>
            </div>
        </div>
    `;

    // 3. Top Overdue (Urutan Hari Terlama)
    const topOvd = data.filter(d => (Number(d.total_overdue) || 0) > 0)
                       .sort((a,b) => (b.hari_overdue || 0) - (a.hari_overdue || 0))
                       .slice(0, 5);

    document.getElementById('list-overdue').innerHTML = topOvd.map((d) => `
        <div class="flex justify-between items-center mb-3">
            <div class="flex flex-col">
                <span class="font-black text-[#1B2559] text-[9px] uppercase truncate w-24">${d.customer_name}</span>
                <span class="bg-red-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded w-fit mt-1">MAX ${d.hari_overdue || 0} HARI</span>
            </div>
            <div class="text-right">
                <span class="font-black text-slate-800 text-[10px] block">${formatJuta(d.total_overdue)}</span>
                <span class="text-[8px] text-slate-400 font-bold">1 UNIT</span>
            </div>
        </div>
    `).join('');
}

updateDateTime();
loadData();
setInterval(updateDateTime, 60000);