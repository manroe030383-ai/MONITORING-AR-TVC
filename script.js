import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ==========================================
// 1. KONFIGURASI SUPABASE
// ==========================================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let donutChart = null;
let barChart = null;

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
        textEl.innerText = `DATA UPDATE: ${days[now.getDay()]} , ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${time} WIB`;
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
    let totalOS = 0, totalOverdue = 0, totalPenalty = 0, totalLancarNominal = 0;
    let cashNominal = 0, leasingNominal = 0, cashUnit = 0, leasingUnit = 0;
    let unitACC = 0, unitTAFS = 0, unitSudahGI = 0, unitRDelivery = 0;
    
    // Variabel baru untuk hitung jumlah SPK (Row data)
    let spkOverdueCount = 0;
    let spkPenaltyCount = 0;

    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        if (!d.no_spk) return;
        const os = Number(d.os_balance) || 0;
        const overdue = Number(d.total_overd) || Number(d.total_overdue) || 0;
        const penalty = Number(d.penalty_amount) || 0;
        const vLancar = Number(d.lancar) || 0;
        const v1_30 = Number(d.hari_1_30) || 0;
        const v31_60 = Number(d.hari_31_60) || 0;
        const vOver60 = Number(d.lebih_60_hari) || 0;
        const leasingName = (d.leasing_name || '').toUpperCase().trim();
        const glDate = String(d.gl_date || '0').trim();

        totalOS += os;
        totalOverdue += overdue;
        totalPenalty += penalty;
        totalLancarNominal += vLancar;

        // LOGIKA HITUNG SPK DINAMIS
        if (overdue > 0) spkOverdueCount++;
        if (penalty > 0) spkPenaltyCount++;

        buckets['LANCAR'] += vLancar / 1000000;
        buckets['1-30 H'] += v1_30 / 1000000;
        buckets['31-60 H'] += v31_60 / 1000000;
        buckets['>60 H'] += vOver60 / 1000000;

        if (leasingName === "CASH" || leasingName === "") {
            cashNominal += os; cashUnit++;
        } else {
            leasingNominal += os; leasingUnit++; 
            if (leasingName.includes("ACC")) unitACC++;
            if (leasingName.includes("TAFS")) unitTAFS++;
            if (glDate !== "0" && glDate !== "") unitSudahGI++; else unitRDelivery++;
        }
    });

    // --- UPDATE TANGGAL ARSIP DB ---
    const skrg = new Date();
    const tglArsipStr = String(skrg.getDate()).padStart(2, '0') + "/" + 
                        String(skrg.getMonth() + 1).padStart(2, '0') + "/" + 
                        skrg.getFullYear();
    updateText('tgl-arsip', tglArsipStr); 

    // Update Text Elements (Nominal)
    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdue));
    updateText('total-penalty', formatIDR(totalPenalty));
    updateText('total-lancar', formatIDR(totalLancarNominal));
    updateText('val-total-cash', formatIDR(cashNominal));
    updateText('val-total-leasing', formatIDR(leasingNominal));
    
    // UPDATE JUMLAH SPK DINAMIS
    updateText('count-overdue-spk', `${spkOverdueCount} SPK LEWAT TOP`);
    updateText('count-penalty-spk', `DARI ${spkPenaltyCount} SPK`);
    
    // Dashboard AR Unit Stats
    updateText('total-penjualan-leasing', (unitACC + unitTAFS) + " Unit"); 
    updateText('unit-sudah-gi', unitSudahGI + " Unit");           
    updateText('unit-r-delivery', unitRDelivery + " Unit");       
    updateText('unit-acc', unitACC + " Cust");
    updateText('unit-tafs', unitTAFS + " Cust");

    // Update Progress Bar O/S Card
    const barCash = document.getElementById('bar-cash');
    const barLeasing = document.getElementById('bar-leasing');
    if (barCash && barLeasing && totalOS > 0) {
        barCash.style.width = `${(cashNominal / totalOS) * 100}%`;
        barLeasing.style.width = `${(leasingNominal / totalOS) * 100}%`;
    }

    // Render Visuals
    try { renderCharts(cashNominal, leasingNominal, Object.values(buckets)); } catch (e) {}
    renderLeasingBreakdown(data, totalOS);
    renderSalesList(data);
    renderTopSPV(data, totalOS);
    renderOverdueList(data);
}

// ==========================================
// 5. RENDER FUNGSI GRAFIK & LIST
// ==========================================

function renderLeasingBreakdown(data, totalOS) {
    const listEl = document.getElementById('leasing-breakdown-list');
    if (!listEl) return;
    const map = {};
    data.forEach(d => {
        const name = (d.leasing_name || '').toUpperCase().trim();
        if (name && name !== 'CASH') {
            map[name] = (map[name] || 0) + (Number(d.os_balance) || 0);
        }
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    listEl.innerHTML = sorted.map(([name, value]) => {
        const pct = totalOS > 0 ? ((value / totalOS) * 100).toFixed(1) : 0;
        return `
            <div class="space-y-1 mb-3">
                <div class="flex justify-between items-center text-[9px] font-bold">
                    <span class="text-slate-600">${name}</span>
                    <div class="flex gap-4">
                        <span class="text-slate-400">${pct}%</span>
                        <span class="text-[#1B2559] font-black">${formatJuta(value)}</span>
                    </div>
                </div>
                <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-blue-600 h-full rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>`;
    }).join('');
}

function renderCharts(cash, leasing, agingData) {
    const donutEl = document.querySelector("#chart-donut-main");
    if (donutEl) {
        if (donutChart) donutChart.destroy();
        donutChart = new ApexCharts(donutEl, {
            series: [cash, leasing],
            labels: ['Cash', 'Leasing'],
            chart: { type: 'donut', height: 230 },
            colors: ['#10B981', '#2563EB'],
            legend: { position: 'bottom' },
            dataLabels: { enabled: false },
            plotOptions: { pie: { donut: { size: '70%' } } }
        });
        donutChart.render();
    }

    const barEl = document.querySelector("#chart-aging-nominal");
    if (barEl) {
        if (barChart) barChart.destroy();
        barChart = new ApexCharts(barEl, {
            series: [{ name: 'Nominal (Juta)', data: agingData }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'], 
            plotOptions: { bar: { distributed: true, borderRadius: 4 } },
            xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] },
            legend: { show: false },
            dataLabels: { enabled: false }
        });
        barChart.render();
    }
}

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
            <div class="flex justify-between items-center py-2 border-b border-gray-50 hover:bg-slate-50 rounded-lg px-2 transition-all">
                <span class="text-[9px] font-bold text-gray-600">${i + 1}. ${s[0]}</span>
                <span class="text-blue-600 font-black text-[10px]">${formatJuta(s[1])}</span>
            </div>`).join('');
    }
}

function renderOverdueList(data) {
    const listEl = document.getElementById('list-overdue');
    if (!listEl) return;
    const overdueData = data
        .filter(d => (Number(d.total_overd) || 0) > 0)
        .sort((a, b) => (Number(b.total_overd) || 0) - (Number(a.total_overd) || 0))
        .slice(0, 5);
    listEl.innerHTML = overdueData.length ? overdueData.map(d => `
        <div class="flex justify-between items-start border-b border-slate-50 pb-2 mb-2 px-1">
            <div>
                <span class="block text-[8px] font-extrabold uppercase text-slate-700">${d.customer_name || 'UNKNOWN'}</span>
                <span class="bg-red-50 text-red-600 border border-red-100 text-[6px] px-1.5 py-0.5 rounded font-bold uppercase">${d.hari_overdue || 0} HARI TERLAMBAT</span>
            </div>
            <div class="text-right">
                <span class="block text-[9px] font-black text-red-600">${formatIDR(d.total_overd)}</span>
            </div>
        </div>`).join('') : '<p class="text-slate-400 text-center italic">Tidak ada data overdue</p>';
}

function renderTopSPV(data, totalOS) {
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
            const pct = totalOS > 0 ? (s[1] / totalOS) * 100 : 0;
            return `
                <div class="mb-3 px-1">
                    <div class="flex justify-between text-[9px] font-bold mb-1">
                        <span>${i + 1}. ${s[0]}</span>
                        <span class="text-[#1B2559]">${formatJuta(s[1])}</span>
                    </div>
                    <div class="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                        <div class="bg-purple-500 h-full rounded-full" style="width:${pct}%"></div>
                    </div>
                </div>`;
        }).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    loadData();
    setInterval(updateDateTime, 60000);
    setInterval(loadData, 300000); 
});// Auto refresh data setiap 5 menit