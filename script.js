import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let donutChart, barChart;

// 2. Fungsi Update Waktu
function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const timeDisplay = `${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')} WIB`;
    
    const tglElem = document.getElementById('tgl-update-text');
    if(tglElem) tglElem.innerText = `DATA UPDATE: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${timeDisplay}`;
}

// 3. Load Data
async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) processData(data);
    } catch (err) {
        console.error("Error:", err.message);
    }
}

// 4. Pengolahan Data Utama
function processData(data) {
    const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    const formatJuta = (n) => (Number(n)/1000000).toFixed(1) + ' Jt';

    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let totalOS = 0, cashNominal = 0, leasingNominal = 0, cashUnit = 0, leasingUnit = 0;

    data.forEach(d => {
        const val = Number(d.os_balance) || 0;
        totalOS += val;
        
        // Cash vs Leasing
        if (String(d.leasing_name || '').toUpperCase() === 'CASH') {
            cashNominal += val; cashUnit++;
        } else {
            leasingNominal += val; leasingUnit++;
        }

        // Perbaikan Aging Logic
        const agingTxt = String(d.status_aging || '').toUpperCase();
        if (agingTxt.includes("LANCAR")) buckets['LANCAR'] += val / 1000000;
        else if (/1\s*-\s*30/.test(agingTxt)) buckets['1-30 H'] += val / 1000000;
        else if (/31\s*-\s*60/.test(agingTxt)) buckets['31-60 H'] += val / 1000000;
        else buckets['>60 H'] += val / 1000000;
    });

    // Render KPI
    document.getElementById('total-os').innerText = formatIDR(totalOS);
    document.getElementById('val-total-cash').innerText = formatIDR(cashNominal);
    document.getElementById('unit-cash').innerText = `${cashUnit} Unit`;
    document.getElementById('val-total-leasing').innerText = formatIDR(leasingNominal);
    document.getElementById('unit-leasing').innerText = `${leasingUnit} Unit`;

    // --- PERBAIKAN: RENDER CARD YANG HILANG ---
    renderTVCBreakdown(data);
    renderTopSPV(data, totalOS);
    renderSalesList(data);
    renderOverdueList(data);
    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
}

// 5. Fungsi Render Khusus untuk TVC & SPV
function renderTVCBreakdown(data) {
    const astraLeasing = ['ACC', 'TAFS'];
    const tvcUnits = data.filter(d => astraLeasing.includes(String(d.leasing_name || '').toUpperCase()));
    const sudahGI = tvcUnits.filter(d => String(d.status_tagih || '').toUpperCase() === 'SUDAH').length;

    document.getElementById('list-tvc').innerHTML = `
        <div class="bg-blue-50 p-4 rounded-2xl text-center mb-4 border border-blue-100">
            <p class="text-[9px] font-bold text-blue-500 uppercase">Total Unit (Leasing Astra)</p>
            <p class="text-2xl font-black text-blue-900">${tvcUnits.length} Unit</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div class="bg-emerald-50 p-3 rounded-xl text-center border border-emerald-100">
                <span class="text-[7px] font-black text-emerald-600 uppercase">SUDAH GI</span>
                <b class="text-sm block text-emerald-700">${sudahGI}</b>
            </div>
            <div class="bg-orange-50 p-3 rounded-xl text-center border border-orange-100">
                <span class="text-[7px] font-black text-orange-600 uppercase">BELUM DELIVERY</span>
                <b class="text-sm block text-orange-700">${tvcUnits.length - sudahGI}</b>
            </div>
        </div>`;
}

function renderTopSPV(data, totalGlobal) {
    const spvMap = {};
    data.forEach(d => {
        const name = d.supervisor_name || 'OTHERS';
        spvMap[name] = (spvMap[name] || 0) + (Number(d.os_balance) || 0);
    });
    const sorted = Object.entries(spvMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    
    document.getElementById('list-spv').innerHTML = sorted.map((s, i) => {
        const pct = ((s[1] / totalGlobal) * 100).toFixed(1);
        return `
            <div class="mb-4">
                <div class="flex justify-between mb-1">
                    <span class="text-[9px] font-black text-[#1B2559] uppercase">${i+1}. ${s[0]}</span>
                    <span class="text-[9px] font-black text-purple-600">${(s[1]/1000000).toFixed(1)} Jt</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-1.5">
                    <div class="bg-purple-500 h-1.5 rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>`;
    }).join('');
}

// 6. Fungsi Render List Sales & Overdue
function renderSalesList(data) {
    const salesMap = {};
    data.forEach(d => {
        const name = d.salesman_name || 'UNKNOWN';
        if(!salesMap[name]) salesMap[name] = { total: 0, unit: 0 };
        salesMap[name].total += Number(d.os_balance) || 0;
        salesMap[name].unit++;
    });
    const sorted = Object.entries(salesMap).sort((a,b) => b[1].total - a[1].total).slice(0, 5);
    document.getElementById('list-salesman').innerHTML = sorted.map((s, i) => `
        <div class="flex justify-between items-center mb-3">
            <span class="text-[10px] font-bold text-[#1B2559] uppercase">${i+1}. ${s[0]}</span>
            <span class="text-[10px] font-bold text-blue-600">${(s[1].total/1000000).toFixed(1)} Jt</span>
        </div>`).join('');
}

function renderOverdueList(data) {
    const overdue = data.filter(d => (Number(d.total_overdue) || 0) > 0)
                        .sort((a,b) => b.total_overdue - a.total_overdue).slice(0, 5);
    document.getElementById('list-overdue').innerHTML = overdue.map((d, i) => `
        <div class="flex justify-between items-center mb-3">
            <div class="flex flex-col">
                <span class="text-[9px] font-bold text-[#1B2559] uppercase">${i+1}. ${d.customer_name}</span>
                <span class="text-[7px] text-red-500 font-bold uppercase">MAX ${d.hari_overdue} HARI</span>
            </div>
            <span class="text-[10px] font-bold text-red-600">${(d.total_overdue/1000000).toFixed(1)} Jt</span>
        </div>`).join('');
}

// 7. Render Charts
function renderCharts(cash, leasing, agingData) {
    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cash, leasing],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 230 },
        colors: ['#10B981', '#422AFB'],
        legend: { position: 'bottom' }
    });
    donutChart.render();

    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal O/S', data: agingData }],
        chart: { type: 'bar', height: 350, toolbar: { show: false } },
        colors: ['#10B981', '#FFD700', '#FF8C00', '#EF4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 8, dataLabels: { position: 'top' } } },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] },
        dataLabels: { enabled: true, offsetY: -20, formatter: (v) => v > 0 ? v.toFixed(1) + ' Jt' : '' }
    });
    barChart.render();
}

// Init
updateDateTime();
loadData();
setInterval(updateDateTime, 60000);