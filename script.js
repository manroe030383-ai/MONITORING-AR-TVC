import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Gunakan key Anda
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let donutChart, barChart;

const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const formatJuta = (n) => (Number(n) / 1000000).toFixed(1) + " Jt";

function updateGlobalDates() {
    const now = new Date();
    document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${now.toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB`;
    document.getElementById('tgl-arsip').innerText = `${now.getDate()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
}

async function loadData() {
    const { data, error } = await supabase.from('ar_unit').select('*');
    if (!error && data) processDashboard(data);
}

function processDashboard(data) {
    let totalOS = 0, totalOverdue = 0, totalPenalty = 0, totalLancar = 0;
    let cashNominal = 0, leasingNominal = 0;
    let unitACC = 0, unitTAFS = 0;
    
    const aging = { 'LANCAR': 0, '1-30H': 0, '31-60H': 0, '>60H': 0 };
    const salesMap = {};
    const spvMap = {};

    data.forEach(d => {
        const os = Number(d.os_balance) || 0;
        const lsn = (d.leasing_name || '').toUpperCase();
        
        totalOS += os;
        totalOverdue += Number(d.total_overd) || 0;
        totalPenalty += Number(d.penalty_amount) || 0;
        totalLancar += Number(d.lancar) || 0;

        // Aging Data (Juta)
        aging['LANCAR'] += (Number(d.lancar) || 0) / 1000000;
        aging['1-30H'] += (Number(d.hari_1_30) || 0) / 1000000;
        aging['31-60H'] += (Number(d.hari_31_60) || 0) / 1000000;
        aging['>60H'] += (Number(d.lebih_60_hari) || 0) / 1000000;

        // Cash vs Leasing
        if (lsn === "CASH" || lsn === "") cashNominal += os; else leasingNominal += os;

        // TVC Logic
        if (lsn.includes("ACC")) unitACC++;
        if (lsn.includes("TAFS")) unitTAFS++;

        // Sales & SPV Maps
        const sName = d.salesman_name || "Unknown";
        const spvName = d.supervisor_name || "Unknown";
        salesMap[sName] = (salesMap[sName] || 0) + os;
        spvMap[spvName] = (spvMap[spvName] || 0) + os;
    });

    // Update KPI & TVC
    document.getElementById('total-os').innerText = formatIDR(totalOS);
    document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
    document.getElementById('total-penalty').innerText = formatIDR(totalPenalty);
    document.getElementById('total-lancar').innerText = formatIDR(totalLancar);
    document.getElementById('val-total-cash').innerText = formatIDR(cashNominal);
    document.getElementById('val-total-leasing').innerText = formatIDR(leasingNominal);
    document.getElementById('total-penjualan-leasing').innerText = (unitACC + unitTAFS) + " Unit";
    document.getElementById('unit-acc').innerText = unitACC + " Cust";
    document.getElementById('unit-tafs').innerText = unitTAFS + " Cust";

    renderCharts(cashNominal, leasingNominal, Object.values(aging));
    renderTopLists(salesMap, spvMap, data, totalOS);
}

function renderCharts(cash, leasing, agingData) {
    if (donutChart) donutChart.destroy();
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cash, leasing],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 250 },
        colors: ['#05CD99', '#4318FF'],
        dataLabels: { enabled: false },
        plotOptions: { pie: { donut: { size: '75%' } } },
        legend: { position: 'bottom' }
    });
    donutChart.render();

    if (barChart) barChart.destroy();
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal', data: agingData }],
        chart: { type: 'bar', height: 280, toolbar: { show: false } },
        colors: ['#05CD99', '#FFB547', '#FF8C00', '#EE5D50'],
        plotOptions: { bar: { distributed: true, borderRadius: 8 } },
        dataLabels: { enabled: false }, // Poin 3: Hilangkan angka di grafik
        xaxis: { categories: ['LANCAR', '1-30H', '31-60H', '>60H'] }
    });
    barChart.render();
}

function renderTopLists(salesMap, spvMap, rawData, totalOS) {
    // Top 5 Salesman
    const sortedSales = Object.entries(salesMap).sort((a,b) => b[1]-a[1]).slice(0,5);
    document.getElementById('list-salesman').innerHTML = sortedSales.map((s, i) => `
        <div class="flex justify-between items-center"><span class="text-[10px] font-bold text-slate-500">${i+1}. ${s[0]}</span><span class="text-[11px] font-black text-blue-600">${formatJuta(s[1])}</span></div>
    `).join('');

    // Top 5 Overdue
    const overdueData = rawData.filter(d => (Number(d.total_overd) || 0) > 0).sort((a,b) => b.total_overd - a.total_overd).slice(0,5);
    document.getElementById('list-overdue').innerHTML = overdueData.map(d => `
        <div class="flex justify-between items-start border-b border-slate-50 pb-2">
            <div><span class="block text-[9px] font-bold uppercase">${d.customer_name}</span><span class="bg-red-500 text-white text-[7px] px-1 rounded font-bold">MAX ${d.hari_overdue} HARI</span></div>
            <span class="text-[10px] font-black text-red-600">${formatJuta(d.total_overd)}</span>
        </div>
    `).join('');

    // Top SPV Distribution
    const sortedSPV = Object.entries(spvMap).sort((a,b) => b[1]-a[1]).slice(0,5);
    document.getElementById('list-spv').innerHTML = sortedSPV.map(s => {
        const pct = ((s[1]/totalOS)*100).toFixed(1);
        return `<div class="space-y-1"><div class="flex justify-between text-[9px] font-bold"><span>${s[0]}</span><span>${formatJuta(s[1])}</span></div><div class="w-full bg-slate-100 h-1 rounded-full"><div class="bg-purple-500 h-1 rounded-full" style="width:${pct}%"></div></div></div>`;
    }).join('');
}

updateGlobalDates();
loadData();
setInterval(loadData, 300000); // Auto refresh 5 menit