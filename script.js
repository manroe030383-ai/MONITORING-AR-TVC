// 1. Konfigurasi Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Utility Functions
const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
const formatJT = (val) => (val / 1000000).toFixed(1);

// 3. Main Function
async function fetchAndRenderDashboard() {
    try {
        // Ganti 'ar_unit' dengan nama tabel asli kamu di Supabase
        const { data, error } = await supabase
            .from('ar_unit') 
            .select('*');

        if (error) throw error;

        // --- A. PERHITUNGAN STATS CARD ---
        const totalOS = data.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
        const overdueData = data.filter(item => item.days_overdue > 0);
        const totalOverdue = overdueData.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
        const totalLancar = totalOS - totalOverdue;
        
        // Update DOM Stats
        document.getElementById('total-os').innerText = formatIDR(totalOS);
        document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
        document.getElementById('count-overdue').innerText = `${overdueData.length} Unit Terlambat`;
        document.getElementById('total-lancar').innerText = formatIDR(totalLancar);

        // --- B. KOMPOSISI CASH VS LEASING ---
        const cashData = data.filter(item => item.payment_type?.toUpperCase() === 'CASH');
        const leasingData = data.filter(item => item.payment_type?.toUpperCase() === 'LEASING');
        
        const sumCash = cashData.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
        const sumLeasing = leasingData.reduce((acc, curr) => acc + (curr.nominal || 0), 0);

        document.getElementById('val-total-cash').innerText = formatIDR(sumCash);
        document.getElementById('unit-cash').innerText = `${cashData.length} Unit`;
        document.getElementById('pct-cash').innerText = totalOS > 0 ? `${((sumCash/totalOS)*100).toFixed(1)}%` : '0%';

        document.getElementById('val-total-leasing').innerText = formatIDR(sumLeasing);
        document.getElementById('unit-leasing').innerText = `${leasingData.length} Unit`;
        document.getElementById('pct-leasing').innerText = totalOS > 0 ? `${((sumLeasing/totalOS)*100).toFixed(1)}%` : '0%';

        // --- C. RENDER CHARTS ---
        renderAgingChart(data);
        renderDonutChart(sumCash, sumLeasing);

        // --- D. RENDER TOP LISTS (Sales, Overdue, SPV) ---
        renderSalesmanList(data);
        renderOverdueList(overdueData);

        // Update Timestamp
        document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;

    } catch (err) {
        console.error('Gagal memuat data:', err.message);
        document.getElementById('tgl-update-text').innerText = "DATA UPDATE: ERROR CONNECTION";
    }
}

// 4. Chart Renderers
function renderAgingChart(data) {
    // Pengelompokan umur piutang (Contoh logika)
    const aging = {
        lancar: data.filter(i => i.days_overdue <= 0).reduce((a, b) => a + (b.nominal || 0), 0),
        top1_30: data.filter(i => i.days_overdue > 0 && i.days_overdue <= 30).reduce((a, b) => a + (b.nominal || 0), 0),
        top31_60: data.filter(i => i.days_overdue > 30 && i.days_overdue <= 60).reduce((a, b) => a + (b.nominal || 0), 0),
        top60up: data.filter(i => i.days_overdue > 60).reduce((a, b) => a + (b.nominal || 0), 0)
    };

    const options = {
        series: [{ name: 'Nominal (Juta)', data: [formatJT(aging.lancar), formatJT(aging.top1_30), formatJT(aging.top31_60), formatJT(aging.top60up)] }],
        chart: { type: 'bar', height: 350, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#EF4444', '#7F1D1D'],
        plotOptions: { bar: { borderRadius: 10, columnWidth: '50%', distributed: true } },
        xaxis: { categories: ['LANCAR', '1-30 HR', '31-60 HR', '> 60 HR'] },
        dataLabels: { enabled: true, formatter: (val) => val + "M" }
    };
    new ApexCharts(document.querySelector("#chart-aging-nominal"), options).render();
}

function renderDonutChart(cash, leasing) {
    const options = {
        series: [cash, leasing],
        chart: { type: 'donut', height: 220 },
        labels: ['Cash', 'Leasing'],
        colors: ['#10B981', '#422AFB'],
        legend: { show: false },
        dataLabels: { enabled: false }
    };
    new ApexCharts(document.querySelector("#chart-donut-main"), options).render();
}

// 5. List Renderers
function renderSalesmanList(data) {
    const container = document.getElementById('list-salesman');
    // Grouping by Salesman Name
    const salesMap = {};
    data.forEach(item => {
        salesMap[item.sales_name] = (salesMap[item.sales_name] || 0) + (item.nominal || 0);
    });

    const sortedSales = Object.entries(salesMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    
    container.innerHTML = sortedSales.map(([name, val], idx) => `
        <div class="flex justify-between items-center text-[10px] font-bold">
            <span class="text-slate-500">${idx+1}. ${name}</span>
            <span class="text-red-500">${formatJT(val)} JT</span>
        </div>
    `).join('');
}

function renderOverdueList(overdueData) {
    const container = document.getElementById('list-overdue');
    const sorted = overdueData.sort((a,b) => b.nominal - a.nominal).slice(0, 5);

    container.innerHTML = sorted.map((item, idx) => `
        <div class="flex justify-between items-center text-[10px] font-bold border-b border-slate-50 pb-2">
            <div>
                <p class="text-[#1B2559] uppercase">${item.customer_name || 'No Name'}</p>
                <p class="text-red-500 text-[8px]">Max ${item.days_overdue} Hari</p>
            </div>
            <span class="text-[#1B2559]">${formatJT(item.nominal)} JT</span>
        </div>
    `).join('');
}

// Inisialisasi saat halaman siap
document.addEventListener('DOMContentLoaded', fetchAndRenderDashboard);