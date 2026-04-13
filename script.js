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

function updateText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

// ==========================================
// 3. FUNGSI UTAMA (LOAD DATA)
// ==========================================
async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) processDashboard(data);
    } catch (err) {
        console.error("Gagal menarik data:", err.message);
    }
}

// ==========================================
// 4. PENGOLAHAN LOGIKA DASHBOARD (PERBAIKAN KRITIKAL)
// ==========================================
function processDashboard(data) {
    let totalOS = 0, totalOverdue = 0, totalPenalty = 0, totalLancar = 0;
    let cashNominal = 0, leasingNominal = 0, tvcNominal = 0;
    let cashUnit = 0, leasingUnit = 0;

    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        const os = Number(d.os_balance) || 0;
        const overdue = Number(d.total_overdue) || 0;
        const penalty = Number(d.penalty_amount) || 0;
        
        // Pembersihan string agar pencocokan data akurat
        const agingStr = (d.status_aging || '').toUpperCase().trim();
        const leasingName = (d.leasing_name || '').toUpperCase().trim();
        const noSpk = String(d.no_spk || '').trim();

        totalOS += os;

        // Perbaikan Pinalty: Tidak hitung jika SPK adalah "0" atau Kosong
        if (noSpk !== "0" && noSpk !== "") {
            totalPenalty += penalty;
        }

        // Perbaikan Aging & Belum Jatuh Tempo
        if (agingStr === "LANCAR") {
            totalLancar += os;
            buckets['LANCAR'] += os / 1000000;
        } else {
            // Jika bukan lancar, masuk ke Overdue
            totalOverdue += os; 
            
            if (agingStr.includes("1-30")) {
                buckets['1-30 H'] += os / 1000000;
            } else if (agingStr.includes("31-60")) {
                buckets['31-60 H'] += os / 1000000;
            } else {
                buckets['>60 H'] += os / 1000000;
            }
        }

        // Komposisi Cash vs Leasing
        if (leasingName === "CASH") {
            cashNominal += os;
            cashUnit++;
        } else {
            leasingNominal += os;
            leasingUnit++;
            // Perbaikan TVC: Hanya ACC dan TAFS
            if (leasingName.includes("ACC") || leasingName.includes("TAFS")) {
                tvcNominal += os;
            }
        }
    });

    // --- Update UI ---
    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdue));
    updateText('total-penalty', formatIDR(totalPenalty));
    updateText('total-lancar', formatIDR(totalLancar));

    updateText('val-total-cash', formatIDR(cashNominal));
    updateText('unit-cash', cashUnit + " Unit");
    updateText('val-total-leasing', formatIDR(tvcNominal)); // Tampilkan nominal TVC saja
    updateText('unit-leasing', leasingUnit + " Unit"); // Total semua unit leasing

    const overdueCount = data.filter(d => (d.status_aging || '').toUpperCase().trim() !== "LANCAR").length;
    updateText('count-overdue', overdueCount + " Unit Terlambat");

    const totalUnit = cashUnit + leasingUnit;
    if (totalUnit > 0) {
        updateText('pct-cash', ((cashUnit / totalUnit) * 100).toFixed(1) + "%");
        updateText('pct-leasing', ((leasingUnit / totalUnit) * 100).toFixed(1) + "%");
    }

    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
    renderSalesList(data);
    renderTopSPV(data, totalOS);
}

// ==========================================
// 5. VISUALISASI
// ==========================================
function renderCharts(cash, leasing, agingData) {
    if (donutChart) donutChart.destroy();
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cash, leasing],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 230 },
        colors: ['#10B981', '#422AFB'],
        legend: { position: 'bottom' }
    });
    donutChart.render();

    if (barChart) barChart.destroy();
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal (Juta)', data: agingData }],
        chart: { type: 'bar', height: 300 },
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
            <div class="flex justify-between items-center py-1 border-b">
                <span class="text-[10px] font-bold">${i + 1}. ${s[0]}</span>
                <span class="text-blue-600 font-black text-[10px]">${formatJuta(s[1])}</span>
            </div>`).join('');
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

updateDateTime();
loadData();
setInterval(updateDateTime, 60000);
setInterval(loadData, 300000);