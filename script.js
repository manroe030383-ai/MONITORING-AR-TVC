import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ==========================================
// 1. KONFIGURASI SUPABASE
// ==========================================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let donutChart = null;
let barChart = null;
let leasingBarsChart = null;

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

function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    
    const time = now.getHours().toString().padStart(2, '0') + "." + now.getMinutes().toString().padStart(2, '0');
    const textEl = document.getElementById('tgl-update-text');
    if (textEl) {
        textEl.innerText = `DATA UPDATE: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${time} WIB`;
    }
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
        if (data && data.length > 0) {
            processDashboard(data);
        }
    } catch (err) {
        console.error("Gagal menarik data:", err.message);
    }
}

// ==========================================
// 4. LOGIKA PEMROSESAN UTAMA
// ==========================================
function processDashboard(data) {
    // Variabel Penampung
    let totalOS = 0, totalOverdue = 0, totalPenalty = 0, totalLancarNominal = 0;
    let cashNominal = 0, leasingNominal = 0;
    let cashUnit = 0, leasingUnit = 0;
    
    let unitACC = 0, unitTAFS = 0;
    let unitSudahGI = 0, unitRDelivery = 0;
    let leasingDataMap = {}; 

    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    // Proses Data Baris per Baris
    data.forEach(d => {
        if (!d.no_spk) return;

        const os = Number(d.os_balance) || 0;
        const overdue = Number(d.total_overd) || 0;
        const penalty = Number(d.penalty_amount) || 0;
        const vLancar = Number(d.lancar) || 0;
        const v1_30 = Number(d.hari_1_30) || 0;
        const v31_60 = Number(d.hari_31_60) || 0;
        const vOver60 = Number(d.lebih_60_hari) || 0;

        let leasingName = (d.leasing_name || 'UNKNOWN').toUpperCase().trim();
        const glDate = String(d.gl_date || '0').trim();

        totalOS += os;
        totalOverdue += overdue;
        totalPenalty += penalty;
        totalLancarNominal += vLancar;

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
            
            // Hitung Breakdown TVC
            if (leasingName.includes("ACC")) unitACC++;
            if (leasingName.includes("TAFS")) unitTAFS++;
            if (glDate !== "0" && glDate !== "") { unitSudahGI++; } else { unitRDelivery++; }

            // Simpan Data per Leasing untuk Grafik
            if (!leasingDataMap[leasingName]) {
                leasingDataMap[leasingName] = { nominal: 0 };
            }
            leasingDataMap[leasingName].nominal += os;
        }
    });

    // --- UPDATE TANGGAL ARSIP DB (OTOMATIS HARI INI) ---
    const skrg = new Date();
    const tglArsip = String(skrg.getDate()).padStart(2, '0') + "/" + 
                     String(skrg.getMonth() + 1).padStart(2, '0') + "/" + 
                     skrg.getFullYear();
    updateText('tgl-arsip', tglArsip);

    // --- UPDATE ANGKA KPI UTAMA ---
    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdue));
    updateText('total-penalty', formatIDR(totalPenalty));
    updateText('total-lancar', formatIDR(totalLancarNominal));
    
    updateText('val-total-cash', formatIDR(cashNominal));
    updateText('unit-cash', cashUnit + " Unit");
    updateText('val-total-leasing', formatIDR(leasingNominal));
    updateText('unit-leasing', leasingUnit + " Unit");

    // --- UPDATE BREAKDOWN TVC ---
    updateText('total-penjualan-leasing', (unitACC + unitTAFS) + " Unit"); 
    updateText('unit-sudah-gi', unitSudahGI + " Unit");           
    updateText('unit-r-delivery', unitRDelivery + " Unit");       
    updateText('unit-acc', unitACC + " Cust");
    updateText('unit-tafs', unitTAFS + " Cust");

    // Persiapan Data Top 5 Leasing
    const sortedLeasingData = Object.entries(leasingDataMap)
        .map(([name, val]) => ({
            name,
            nominal: val.nominal,
            percent: totalOS > 0 ? ((val.nominal / totalOS) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.nominal - a.nominal).slice(0, 5);

    // --- RENDER SEMUA GRAFIK ---
    try { renderDonut(cashNominal, leasingNominal); } catch(e) { console.error(e); }
    try { renderAgingBar(Object.values(buckets)); } catch(e) { console.error(e); }
    try { renderLeasingBars(sortedLeasingData); } catch(e) { console.error(e); }
    
    // --- RENDER TABEL LIST ---
    renderSalesList(data);
    renderTopSPV(data, totalOS);
}

// ==========================================
// 5. FUNGSI RENDER GRAFIK
// ==========================================
function renderDonut(cash, leasing) {
    const el = document.querySelector("#chart-donut-main");
    if (!el) return;
    if (donutChart) donutChart.destroy();
    donutChart = new ApexCharts(el, {
        series: [cash, leasing],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 230 },
        colors: ['#00E396', '#422AFB'],
        dataLabels: { enabled: false },
        legend: { position: 'bottom' }
    });
    donutChart.render();
}

function renderAgingBar(agingData) {
    const el = document.querySelector("#chart-aging-nominal");
    if (!el) return;
    if (barChart) barChart.destroy();
    barChart = new ApexCharts(el, {
        series: [{ name: 'Nominal (Juta)', data: agingData }],
        chart: { type: 'bar', height: 280, toolbar: { show: false } },
        colors: ['#00E396', '#FEB019', '#FF4560', '#775DD0'],
        plotOptions: { bar: { distributed: true, borderRadius: 6 } },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] },
        legend: { show: false },
        dataLabels: { enabled: false }
    });
    barChart.render();
}

function renderLeasingBars(lData) {
    const el = document.querySelector("#chart-leasing-bars");
    if (!el) return;
    if (leasingBarsChart) leasingBarsChart.destroy();
    leasingBarsChart = new ApexCharts(el, {
        series: [{ name: 'OS', data: lData.map(d => d.nominal) }],
        chart: { type: 'bar', height: 200, toolbar: { show: false } },
        plotOptions: { 
            bar: { 
                horizontal: true, 
                borderRadius: 4,
                barHeight: '50%'
            } 
        },
        colors: ['#422AFB'],
        grid: { show: false },
        xaxis: { 
            categories: lData.map(d => d.name),
            labels: { show: false },
            axisBorder: { show: false }
        },
        yaxis: {
            labels: { style: { fontSize: '10px', fontWeight: 600 } }
        },
        dataLabels: {
            enabled: true,
            textAnchor: 'start',
            offsetX: 10,
            formatter: (val, opt) => `${lData[opt.dataPointIndex].percent}% (${formatJuta(val)})`,
            style: { fontSize: '10px', colors: ['#1B2559'] }
        }
    });
    leasingBarsChart.render();
}

// ==========================================
// 6. FUNGSI RENDER LIST (TABEL)
// ==========================================
function renderSalesList(data) {
    const map = {};
    data.forEach(d => {
        if (!d.no_spk) return;
        const name = d.salesman_name || "UNKNOWN";
        map[name] = (map[name] || 0) + (Number(d.os_balance) || 0);
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const listEl = document.getElementById('list-salesman');
    if (listEl) {
        listEl.innerHTML = sorted.map((s, i) => `
            <div class="flex justify-between items-center py-1 border-b border-gray-50">
                <span class="text-[9px] font-bold text-gray-600">${i + 1}. ${s[0]}</span>
                <span class="text-blue-600 font-black text-[10px]">${formatJuta(s[1])}</span>
            </div>
        `).join('');
    }
}

function renderTopSPV(data, total) {
    const map = {};
    data.forEach(d => {
        if (!d.no_spk) return;
        const name = d.supervisor_name || "OTHERS";
        map[name] = (map[name] || 0) + (Number(d.os_balance) || 0);
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const listEl = document.getElementById('list-spv');
    if (listEl) {
        listEl.innerHTML = sorted.map((s, i) => {
            const pct = total > 0 ? (s[1] / total) * 100 : 0;
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

// ==========================================
// 7. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    loadData();
    setInterval(updateDateTime, 60000);
    setInterval(loadData, 300000); 
});// Auto refresh data setiap 5 menit
