import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let donutChart = null, barChart = null;

const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
function updateText(id, value) { const el = document.getElementById(id); if (el) el.innerText = value; }

function updateDateTime() {
    const now = new Date();
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    updateText('tgl-update-text', `DATA UPDATE: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${time} WIB`);
}

async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) {
            processDashboard(data);
            renderDetailedTables(data);
            
            // Mengambil tgl arsip dari record terbaru
            const archiveDate = data.reduce((latest, item) => {
                const current = new Date(item.created_at);
                return current > latest ? current : latest;
            }, new Date(0));
            
            if (archiveDate.getTime() > 0) {
                updateText('tgl-arsip', `${archiveDate.getDate().toString().padStart(2, '0')}/${(archiveDate.getMonth()+1).toString().padStart(2, '0')}/${archiveDate.getFullYear()}`);
            }
        }
    } catch (err) { console.error("Error:", err.message); }
}

function processDashboard(data) {
    let totalOS = 0, totalOverdue = 0, totalPenalty = 0;
    let cashNominal = 0, leasingNominal = 0;
    let unitSudahGI = 0, unitRDelivery = 0, unitLeasingCount = 0;
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        const os = Number(d.os_balance) || 0;
        const overdueValue = Number(d.total_overd) || 0;
        const penalty = Number(d.penalty_amount) || 0;
        const age = Number(d.hari_overdue) || 0;
        const leasingName = (d.leasing_name || '').toUpperCase().trim();

        totalOS += os;
        totalOverdue += overdueValue;
        totalPenalty += penalty;

        // Perhitungan Aging Analysis (Berdasarkan Nominal OS)
        if (age <= 0) buckets['LANCAR'] += os;
        else if (age <= 30) buckets['1-30 H'] += os;
        else if (age <= 60) buckets['31-60 H'] += os;
        else buckets['>60 H'] += os;

        if (leasingName === "CASH" || leasingName === "") {
            cashNominal += os;
        } else {
            leasingNominal += os;
            unitLeasingCount++;
            if (d.gl_date && d.gl_date !== "0" && d.gl_date !== "-") unitSudahGI++; 
            else unitRDelivery++;
        }
    });

    // Update Kartu Utama
    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdue));
    updateText('total-penalty', formatIDR(totalPenalty));
    
    // Logika Krusial: Belum Jatuh Tempo = Total OS - Total Overdue
    const belumJatuhTempo = totalOS - totalOverdue;
    updateText('total-lancar', formatIDR(belumJatuhTempo));

    // Update Badge Overdue
    const countOverdueSPK = data.filter(x => Number(x.total_overd) > 0).length;
    updateText('count-overdue-spk', `${countOverdueSPK} SPK LEWAT TOP`);
    
    // Update Info Unit
    updateText('total-penjualan-leasing', unitLeasingCount + " Unit");
    updateText('unit-sudah-gi', unitSudahGI);
    updateText('unit-r-delivery', unitRDelivery);
    updateText('val-total-cash', formatIDR(cashNominal));
    updateText('val-total-leasing', formatIDR(leasingNominal));

    // Progress Bar
    const bCash = document.getElementById('bar-cash');
    const bLeasing = document.getElementById('bar-leasing');
    if (totalOS > 0) {
        if (bCash) bCash.style.width = `${(cashNominal / totalOS) * 100}%`;
        if (bLeasing) bLeasing.style.width = `${(leasingNominal / totalOS) * 100}%`;
    }

    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
    renderSalesList(data);
    renderOverdueList(data);
    renderTopSPV(data, totalOS);
}

function renderCharts(cash, leasing, agingData) {
    if (donutChart) donutChart.destroy();
    donutChart = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: [cash, leasing], labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 250 }, colors: ['#10B981', '#2563EB'],
        plotOptions: { pie: { donut: { size: '75%' } } }, legend: { position: 'bottom' }
    });
    donutChart.render();

    // Bar Chart Aging (Konversi ke Juta agar visualisasi rapi)
    const agingInJuta = agingData.map(v => v / 1000000);
    if (barChart) barChart.destroy();
    barChart = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal (Juta)', data: agingInJuta }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } }, 
        colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 6, columnWidth: '60%' } },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] },
        yaxis: { labels: { formatter: (val) => val.toFixed(0) + "jt" } }
    });
    barChart.render();
}

// ... Sisanya tetap menggunakan fungsi renderDetailedTables, renderSalesList, dll ...

document.addEventListener('DOMContentLoaded', () => {
    updateDateTime(); loadData();
    setInterval(updateDateTime, 60000);
    setInterval(loadData, 300000); // Sinkronisasi otomatis setiap 5 menit
});