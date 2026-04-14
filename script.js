import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ==========================================
// 1. KONFIGURASI SUPABASE
// ==========================================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let donutChart;
let barChart;

// ==========================================
// 2. HELPER / FORMATTER
// ==========================================
const formatIDR = (n) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(n || 0);

const formatJuta = (n) =>
    (Number(n) / 1000000).toFixed(1) + " Jt";

function updateText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

// ==========================================
// 3. FUNGSI LOAD DATA
// ==========================================
async function loadData() {
    try {
        const { data, error } = await supabase
            .from('ar_unit')
            .select('*');

        if (error) throw error;
        if (data) processDashboard(data);
    } catch (err) {
        console.error("Gagal menarik data:", err.message);
    }
}

// ==========================================
// 4. LOGIKA PEMROSESAN UTAMA
// ==========================================
function processDashboard(data) {
    let totalOS = 0, totalOverdueNominal = 0, totalPenalty = 0, totalLancarNominal = 0;
    let cashNominal = 0, leasingNominal = 0;
    let cashUnit = 0, leasingUnit = 0;
    
    let unitACC = 0;
    let unitTAFS = 0;
    let unitSudahGI = 0;
    let unitRDelivery = 0;

    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        // Pemetaan kolom sesuai screenshot database terbaru Anda
        const os = Number(d.os_balance) || 0;
        const vLancar = Number(d.lancar) || 0;
        const v1_30 = Number(d.hari_1_30) || 0;
        const v31_60 = Number(d.hari_31_60) || 0;
        const vOver60 = Number(d.lebih_60_hari) || 0;
        
        // Perbaikan nama kolom: 'total_overd' dan 'penalty_amount'
        const overdueNominal = Number(d.total_overd) || 0; 
        const penaltyAmount = Number(d.penalty_amount) || 0;
        const overdueDays = Number(d.hari_overdue) || 0;

        const leasingName = (d.leasing_name || '').toUpperCase().trim();
        const funcLoc = (d.func_loc || '').toUpperCase().trim(); 

        totalOS += os;
        totalOverdueNominal += overdueNominal;
        totalPenalty += penaltyAmount;
        totalLancarNominal += vLancar;

        // Data Grafik Aging
        buckets['LANCAR'] += vLancar / 1000000;
        buckets['1-30 H'] += v1_30 / 1000000;
        buckets['31-60 H'] += v31_60 / 1000000;
        buckets['>60 H'] += vOver60 / 1000000;

        if (leasingName === "CASH" || leasingName === "") {
            cashNominal += os;
            cashUnit++;
        } else {
            leasingNominal += os;
            leasingUnit++; 
            
            // Filter Krusial: Hanya hitung jika overdueDays > 0
            // Ini yang memastikan angka berubah dari 87 menjadi 29 (sesuai data jatuh tempo)
            if (overdueDays > 0) {
                if (leasingName.includes("ACC")) unitACC++;
                if (leasingName.includes("TAFS")) unitTAFS++;

                // Logika GI vs Delivery berdasarkan func_loc (T710/T730)
                if (funcLoc.includes("T710") || funcLoc.includes("GI")) {
                    unitSudahGI++;
                } else {
                    unitRDelivery++;
                }
            }
        }
    });

    const totalUnitTVC = unitACC + unitTAFS;

    // UPDATE UI RINGKASAN & KPI
    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdueNominal)); 
    updateText('total-penalty', formatIDR(totalPenalty)); 
    updateText('total-lancar', formatIDR(totalLancarNominal));

    // UPDATE BREAKDOWN LEASING TVC
    updateText('total-penjualan-leasing', totalUnitTVC + " Unit"); 
    updateText('unit-sudah-gi', unitSudahGI + " Unit");           
    updateText('unit-r-delivery', unitRDelivery + " Unit");       
    updateText('unit-acc', unitACC + " Unit");
    updateText('unit-tafs', unitTAFS + " Unit");
    updateText('count-overdue', totalUnitTVC + " Unit Terlambat");

    // UPDATE SUMMARY KECIL
    updateText('val-total-cash', formatIDR(cashNominal));
    updateText('unit-cash', cashUnit + " Unit");
    updateText('val-total-leasing', formatIDR(leasingNominal));
    updateText('unit-leasing', leasingUnit + " Unit");

    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
    renderSalesList(data);
    renderTopSPV(data, totalOS);
}

// ==========================================
// 5. FUNGSI VISUALISASI (CHARTS & LIST)
// ==========================================
function renderCharts(cash, leasing, agingData) {
    if (donutChart) donutChart.destroy();
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cash, leasing],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 230 },
        colors: ['#10B981', '#422AFB'],
        legend: { position: 'bottom' },
        dataLabels: { enabled: true, formatter: (val) => val.toFixed(1) + "%" }
    });
    donutChart.render();

    if (barChart) barChart.destroy();
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal (Juta)', data: agingData }],
        chart: { type: 'bar', height: 300, toolbar: { show: false } },
        colors: ['#10B981', '#FFD700', '#FF8C00', '#EF4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 6 } },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] },
        dataLabels: { enabled: true, formatter: (v) => v.toFixed(1) + " Jt" }
    });
    barChart.render();
}

function renderSalesList(data) {
    const map = {};
    data.forEach(d => {
        const name = d.salesman_name || "UNKNOWN";
        map[name] = (map[name] || 0) + (Number(d.os_balance) || 0);
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const listEl = document.getElementById('list-salesman');
    if (listEl) {
        listEl.innerHTML = sorted.map((s, i) => `
            <div class="flex justify-between items-center py-1 border-b border-gray-50">
                <span class="text-[10px] font-bold text-gray-600">${i + 1}. ${s[0]}</span>
                <span class="text-blue-600 font-black text-[10px]">${formatJuta(s[1])}</span>
            </div>
        `).join('');
    }
}

function renderTopSPV(data, totalOS) {
    const map = {};
    data.forEach(d => {
        const name = d.supervisor_name || "OTHERS";
        map[name] = (map[name] || 0) + (Number(d.os_balance) || 0);
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const listEl = document.getElementById('list-spv');
    if (listEl) {
        listEl.innerHTML = sorted.map((s, i) => {
            const pct = totalOS > 0 ? (s[1] / totalOS) * 100 : 0;
            return `
                <div class="mb-2">
                    <div class="flex justify-between text-[9px] font-bold mb-1">
                        <span>${i + 1}. ${s[0]}</span>
                        <span>${formatJuta(s[1])}</span>
                    </div>
                    <div class="w-full bg-gray-100 h-1 rounded-full">
                        <div class="bg-purple-500 h-1 rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>`;
        }).join('');
    }
}

// Jalankan Inisialisasi
loadData();