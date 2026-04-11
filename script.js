const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const _supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_KEY);

const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
const formatJT = (val) => (val / 1000000).toFixed(1);

async function fetchAndRenderDashboard() {
    try {
        const { data, error } = await _supabase.from('ar_unit').select('*');
        if (error) throw error;

        // 1. HITUNG STATS UTAMA
        // Di screenshot database sebelumnya, pastikan nama kolom nominal adalah 'nominal'
        // Jika namanya 'total_tagihan', ganti curr.nominal menjadi curr.total_tagihan
        const totalOS = data.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
        const overdueData = data.filter(item => (Number(item.days_overdue) || 0) > 0);
        const totalOverdue = overdueData.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
        const totalLancar = totalOS - totalOverdue;
        
        document.getElementById('total-os').innerText = formatIDR(totalOS);
        document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
        document.getElementById('total-lancar').innerText = formatIDR(totalLancar);
        document.getElementById('count-overdue').innerText = `${overdueData.length} SPK Lewat TOP`;

        // 2. KOMPOSISI PAYMENT (Berdasarkan kolom 'leasing_name')
        const cashData = data.filter(item => item.leasing_name?.toUpperCase() === 'CASH');
        const leasingData = data.filter(item => item.leasing_name?.toUpperCase() !== 'CASH');
        const sumCash = cashData.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
        const sumLeasing = leasingData.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);

        document.getElementById('val-total-cash').innerText = formatIDR(sumCash);
        document.getElementById('unit-cash').innerText = `${cashData.length} Unit`;
        document.getElementById('val-total-leasing').innerText = formatIDR(sumLeasing);
        document.getElementById('unit-leasing').innerText = `${leasingData.length} Unit`;

        // 3. RENDER SEMUA GRAFIK & LIST
        renderAgingChart(data);
        renderDonutChart(sumCash, sumLeasing);
        renderSalesmanList(data);
        renderOverdueList(overdueData);
        renderSPVList(data); // Tambahan untuk SPV

        document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;

    } catch (err) {
        console.error('Error:', err.message);
    }
}

// FUNGSI RENDER LIST SALESMAN (Kolom: salesman_name)
function renderSalesmanList(data) {
    const container = document.getElementById('list-salesman');
    const salesMap = {};
    data.forEach(item => {
        const name = item.salesman_name || 'No Name';
        salesMap[name] = (salesMap[name] || 0) + (Number(item.nominal) || 0);
    });
    const sorted = Object.entries(salesMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    container.innerHTML = sorted.map(([name, val], idx) => `
        <div class="flex justify-between items-center text-[10px] font-bold mb-3">
            <span class="text-slate-500">${idx+1}. ${name}</span>
            <span class="text-red-500">${formatJT(val)} JT</span>
        </div>`).join('');
}

// FUNGSI RENDER LIST SPV (Kolom: supervisor_name)
function renderSPVList(data) {
    const container = document.getElementById('list-spv');
    const spvMap = {};
    data.forEach(item => {
        const name = item.supervisor_name || 'No Name';
        spvMap[name] = (spvMap[name] || 0) + (Number(item.nominal) || 0);
    });
    const sorted = Object.entries(spvMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    container.innerHTML = sorted.map(([name, val], idx) => `
        <div class="flex justify-between items-center text-[10px] font-bold mb-3">
            <span class="text-slate-500">${idx+1}. ${name}</span>
            <span class="text-purple-600">${formatJT(val)} JT</span>
        </div>`).join('');
}

function renderAgingChart(data) {
    const aging = {
        lancar: data.filter(i => (Number(i.days_overdue)||0) <= 0).reduce((a, b) => a + (Number(b.nominal)||0), 0),
        t1_30: data.filter(i => (Number(i.days_overdue)||0) > 0 && i.days_overdue <= 30).reduce((a, b) => a + (Number(b.nominal)||0), 0),
        t31_60: data.filter(i => (Number(i.days_overdue)||0) > 30 && i.days_overdue <= 60).reduce((a, b) => a + (Number(b.nominal)||0), 0),
        t60up: data.filter(i => (Number(i.days_overdue)||0) > 60).reduce((a, b) => a + (Number(b.nominal)||0), 0)
    };

    const options = {
        series: [{ name: 'Nominal', data: [formatJT(aging.lancar), formatJT(aging.t1_30), formatJT(aging.t31_60), formatJT(aging.t60up)] }],
        chart: { type: 'bar', height: 250, toolbar: {show:false} },
        colors: ['#10B981', '#F59E0B', '#EF4444', '#7F1D1D'],
        plotOptions: { bar: { borderRadius: 10, columnWidth: '50%', distributed: true } },
        xaxis: { categories: ['LANCAR', '1-30 HR', '31-60 HR', '> 60 HR'] },
        dataLabels: { enabled: true, formatter: (val) => val + "M" }
    };
    document.querySelector("#chart-aging-nominal").innerHTML = ""; // Bersihkan div
    new ApexCharts(document.querySelector("#chart-aging-nominal"), options).render();
}

function renderDonutChart(cash, leasing) {
    const options = {
        series: [cash, leasing],
        chart: { type: 'donut', height: 200 },
        labels: ['Cash', 'Leasing'],
        colors: ['#10B981', '#422AFB'],
        legend: { position: 'bottom' },
        dataLabels: { enabled: false }
    };
    document.querySelector("#chart-donut-main").innerHTML = "";
    new ApexCharts(document.querySelector("#chart-donut-main"), options).render();
}

function renderOverdueList(overdueData) {
    const container = document.getElementById('list-overdue');
    const sorted = overdueData.sort((a,b) => b.nominal - a.nominal).slice(0, 5);
    container.innerHTML = sorted.map((item, idx) => `
        <div class="flex justify-between items-center text-[9px] font-bold border-b border-slate-50 pb-2 mb-2">
            <div>
                <p class="text-[#1B2559] uppercase">${item.customer_name || 'No Name'}</p>
                <p class="text-red-500 text-[8px] italic">${item.days_overdue} Hari Terlambat</p>
            </div>
            <span class="text-[#1B2559]">${formatJT(item.nominal)} JT</span>
        </div>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchAndRenderDashboard);