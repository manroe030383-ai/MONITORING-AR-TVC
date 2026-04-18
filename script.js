import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let donutChart = null, barChart = null;

const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
function updateText(id, value) { const el = document.getElementById(id); if (el) el.innerText = value; }

// Sinkronisasi Waktu
function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    updateText('tgl-update-text', `DATA UPDATE: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${time} WIB`);
}

// Navigasi Tab
window.showSection = function(sectionId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`${sectionId}-section`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-600', 'text-white');
        btn.classList.add('text-slate-400');
    });
    const activeBtn = document.querySelector(`[data-tab="${sectionId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active', 'bg-blue-600', 'text-white');
        activeBtn.classList.remove('text-slate-400');
    }
};

async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) {
            processDashboard(data);
            renderDetailedTables(data);
            if (data[0]?.created_at) {
                const d = new Date(data[0].created_at);
                updateText('tgl-arsip', `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`);
            }
        }
    } catch (err) { console.error("Error:", err.message); }
}

function processDashboard(data) {
    let tOS = 0, tOverdue = 0, tPenalty = 0;
    let cashNom = 0, leasNom = 0;
    let unitGI = 0, unitRD = 0, leasCount = 0;
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        const os = parseFloat(d.os_balance) || 0;
        const ov = parseFloat(d.total_overd) || 0;
        const pen = parseFloat(d.penalty_amount) || 0;
        const hari = parseInt(d.hari_overdue) || 0;
        const type = (d.leasing_name || '').toUpperCase().trim();

        tOS += os;
        tOverdue += ov;
        tPenalty += pen;

        if (hari <= 0) buckets['LANCAR'] += os;
        else if (hari <= 30) buckets['1-30 H'] += os;
        else if (hari <= 60) buckets['31-60 H'] += os;
        else buckets['>60 H'] += os;

        if (type === "CASH" || type === "") {
            cashNom += os;
        } else {
            leasNom += os;
            leasCount++;
            if (d.gl_date && d.gl_date !== "0" && d.gl_date !== "-") unitGI++; 
            else unitRD++;
        }
    });

    // Update Kartu Utama
    updateText('total-os', formatIDR(tOS));
    updateText('total-overdue', formatIDR(tOverdue));
    updateText('total-penalty', formatIDR(tPenalty));
    updateText('total-lancar', formatIDR(tOS - tOverdue));

    // Badge & Detail
    const ovCount = data.filter(x => (parseFloat(x.total_overd) || 0) > 0).length;
    updateText('count-overdue-spk', `${ovCount} SPK LEWAT TOP`);
    updateText('total-penjualan-leasing', leasCount + " Unit");
    updateText('unit-sudah-gi', unitGI);
    updateText('unit-r-delivery', unitRD);
    updateText('val-total-cash', formatIDR(cashNom));
    updateText('val-total-leasing', formatIDR(leasNom));

    // Bar Progress
    const bCash = document.getElementById('bar-cash');
    const bLeas = document.getElementById('bar-leasing');
    if (tOS > 0) {
        if (bCash) bCash.style.width = `${(cashNom / tOS) * 100}%`;
        if (bLeas) bLeas.style.width = `${(leasNom / tOS) * 100}%`;
    }

    renderCharts(cashNom, leasNom, Object.values(buckets));
    renderSideLists(data, tOS);
}

// Fungsi render chart dan tabel tetap sama dengan kode Anda, 
// pastikan ID pemanggilnya sesuai (#chart-donut-main, #chart-aging-nominal)

function renderCharts(cash, leasing, agingValues) {
    if (donutChart) donutChart.destroy();
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cash, leasing],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 250 },
        colors: ['#10B981', '#2563EB'],
        plotOptions: { pie: { donut: { size: '70%' } } },
        legend: { position: 'bottom' }
    });
    donutChart.render();

    if (barChart) barChart.destroy();
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal', data: agingValues.map(v => v / 1000000) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'],
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] },
        yaxis: { labels: { formatter: (v) => v.toFixed(0) + 'jt' } }
    });
    barChart.render();
}

// Tambahkan sisa fungsi renderDetailedTables dan renderSideLists dari kode Anda sebelumnya

document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    loadData();
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.showSection(btn.getAttribute('data-tab'));
        });
    });

    setInterval(updateDateTime, 60000);
    setInterval(loadData, 300000);
});