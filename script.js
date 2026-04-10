import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let donutChart, barChart;

// 2. Load Data Utama
async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) processDashboard(data);
    } catch (err) {
        console.error("Gagal memuat data:", err.message);
    }
}

// 3. Logika Pemrosesan Dashboard
function processDashboard(data) {
    const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
    
    // Inisialisasi Buckets Aging & KPI
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let totalOS = 0, cashNom = 0, leasNom = 0, cashU = 0, leasU = 0;

    data.forEach(d => {
        const os = Number(d.os_balance) || 0;
        totalOS += os;

        // Klasifikasi Aging (Normalisasi teks agar tidak salah filter)
        const rawAging = String(d.status_aging || '').toUpperCase().replace(/\s/g, '');
        if (rawAging.includes("LANCAR")) buckets['LANCAR'] += os / 1000000;
        else if (rawAging.includes("1-30")) buckets['1-30 H'] += os / 1000000;
        else if (rawAging.includes("31-60")) buckets['31-60 H'] += os / 1000000;
        else buckets['>60 H'] += os / 1000000;

        // Klasifikasi Cash vs Leasing
        if (String(d.leasing_name || '').toUpperCase().trim() === 'CASH') {
            cashNom += os; cashU++;
        } else {
            leasNom += os; leasU++;
        }
    });

    // Update Elemen HTML (KPI Utama)
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = formatIDR(totalOS);
    if(document.getElementById('val-total-cash')) document.getElementById('val-total-cash').innerText = formatIDR(cashNom);
    if(document.getElementById('unit-cash')) document.getElementById('unit-cash').innerText = `${cashU} UNIT`;
    if(document.getElementById('val-total-leasing')) document.getElementById('val-total-leasing').innerText = formatIDR(leasNom);
    if(document.getElementById('unit-leasing')) document.getElementById('unit-leasing').innerText = `${leasU} UNIT`;

    // Render Semua Bagian
    renderTVC(data);
    renderSPV(data, totalOS);
    renderSales(data);
    renderOverdue(data);
    renderCharts(cashNom, leasNom, Object.values(buckets));
}

// 4. Render Card TVC Breakdown
function renderTVC(data) {
    // Filter unit yang menggunakan leasing Astra (ACC/TAFS)
    const tvcUnits = data.filter(d => ['ACC', 'TAFS'].includes(String(d.leasing_name || '').toUpperCase().trim()));
    // Cek status tagih (Sudah GI)
    const sudahGI = tvcUnits.filter(d => String(d.status_tagih || '').toUpperCase().trim() === 'SUDAH').length;

    const container = document.getElementById('list-tvc');
    if (!container) return;

    container.innerHTML = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                <span class="text-[10px] font-bold text-blue-500 uppercase">Unit Astra (ACC/TAFS)</span>
                <div class="text-2xl font-black text-blue-900">${tvcUnits.length} <small class="text-sm">UNIT</small></div>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <div class="p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                    <p class="text-[8px] font-black text-emerald-600">SUDAH GI</p>
                    <p class="text-lg font-black text-emerald-700">${sudahGI}</p>
                </div>
                <div class="p-2 bg-red-50 rounded-lg border border-red-100 text-center">
                    <p class="text-[8px] font-black text-red-600">BELUM GI</p>
                    <p class="text-lg font-black text-red-700">${tvcUnits.length - sudahGI}</p>
                </div>
            </div>
        </div>`;
}

// 5. Render Card Top SPV AR
function renderSPV(data, total) {
    const spvMap = {};
    data.forEach(d => {
        const name = (d.supervisor_name || 'OTHERS').toUpperCase();
        spvMap[name] = (spvMap[name] || 0) + (Number(d.os_balance) || 0);
    });

    const sorted = Object.entries(spvMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const container = document.getElementById('list-spv');
    if (!container) return;

    container.innerHTML = sorted.map((s, i) => {
        const pct = total > 0 ? ((s[1] / total) * 100).toFixed(1) : 0;
        return `
            <div class="mb-4">
                <div class="flex justify-between text-[10px] font-black text-[#1B2559] mb-1">
                    <span>${i+1}. ${s[0]}</span>
                    <span class="text-purple-600">${(s[1]/1000000).toFixed(1)} Jt</span>
                </div>
                <div class="w-full bg-slate-100 h-1.5 rounded-full">
                    <div class="bg-purple-500 h-full rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>`;
    }).join('');
}

// 6. Render List Sales & Overdue
function renderSales(data) {
    const sales = {};
    data.forEach(d => {
        const n = (d.salesman_name || 'UNKNOWN').toUpperCase();
        if(!sales[n]) sales[n] = { total: 0, unit: 0 };
        sales[n].total += Number(d.os_balance) || 0;
        sales[n].unit++;
    });
    const sorted = Object.entries(sales).sort((a,b) => b[1].total - a[1].total).slice(0, 5);
    document.getElementById('list-salesman').innerHTML = sorted.map((s, i) => `
        <div class="flex justify-between items-center py-2 border-b border-slate-50">
            <span class="text-[10px] font-bold text-[#1B2559]">${i+1}. ${s[0]}</span>
            <span class="text-[10px] font-black text-blue-600">${(s[1].total/1000000).toFixed(1)} Jt</span>
        </div>`).join('');
}

function renderOverdue(data) {
    const ovd = data.filter(d => (Number(d.total_overdue) || 0) > 0)
                    .sort((a,b) => b.total_overdue - a.total_overdue).slice(0, 5);
    document.getElementById('list-overdue').innerHTML = ovd.map((d, i) => `
        <div class="flex justify-between items-center py-2 border-b border-slate-50">
            <div>
                <p class="text-[9px] font-bold text-[#1B2559]">${i+1}. ${d.customer_name}</p>
                <span class="text-[7px] bg-red-100 text-red-600 px-1 rounded font-black uppercase">MAX ${d.hari_overdue} HARI</span>
            </div>
            <span class="text-[10px] font-black text-red-600">${(Number(d.total_overdue)/1000000).toFixed(1)} Jt</span>
        </div>`).join('');
}

// 7. Render Charts
function renderCharts(cash, leas, aging) {
    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cash, leas],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 230 },
        colors: ['#10B981', '#422AFB'],
        legend: { position: 'bottom' }
    });
    donutChart.render();

    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal', data: aging }],
        chart: { type: 'bar', height: 350, toolbar: { show: false } },
        colors: ['#10B981', '#FFD700', '#FF8C00', '#EF4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 8, dataLabels: { position: 'top' } } },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] },
        dataLabels: { enabled: true, offsetY: -20, formatter: (v) => v > 0 ? v.toFixed(1) + ' Jt' : '' }
    });
    barChart.render();
}

// Jalankan
loadData();