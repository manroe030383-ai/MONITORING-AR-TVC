import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'
const supabase = createClient(supabaseUrl, supabaseKey)

let chartAging, chartDonut;

async function loadDashboardData() {
    try {
        const { data: arData, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        processData(arData);
    } catch (err) {
        console.error("Gagal mengambil data:", err.message);
    }
}

function processData(data) {
    let totalOS = 0, totalLancar = 0, totalOverdue = 0, totalPenalty = 0;
    let cashNominal = 0, leasingNominal = 0, cashUnit = 0, leasingUnit = 0;
    let penaltyCount = 0, tafsCount = 0, accCount = 0;
    let aging = { lancar: 0, h1_30: 0, h31_60: 0, over60: 0 };

    data.forEach(item => {
        const nominal = parseFloat(item.os_balance) || 0;
        const penaltyVal = parseFloat(item.penalty_amount) || 0;
        const leasingName = (item.leasing_name || "").toUpperCase().trim();
        const statusAging = (item.status_aging || "").toUpperCase().trim();

        totalOS += nominal;

        // 1. Logika Cash vs Leasing & Breakdown TVC
        if (leasingName === 'CASH') {
            cashNominal += nominal;
            cashUnit++;
        } else {
            leasingNominal += nominal;
            leasingUnit++;
            if (leasingName === 'TAFS') tafsCount++;
            if (leasingName === 'ACC') accCount++;
        }

        // 2. Logika Aging (Lebih fleksibel dengan toUpperCase)
        if (statusAging === 'LANCAR') {
            totalLancar += nominal;
            aging.lancar += nominal;
        } else {
            totalOverdue += nominal;
            if (statusAging === '1-30 HR' || statusAging === '1-30H') aging.h1_30 += nominal;
            else if (statusAging === '31-60 HR' || statusAging === '31-60H') aging.h31_60 += nominal;
            else aging.over60 += nominal;
        }

        // 3. Logika Potensi Penalti
        if (penaltyVal > 0) {
            totalPenalty += penaltyVal;
            penaltyCount++;
        }
    });

    updateUI(totalOS, totalOverdue, totalPenalty, totalLancar, cashNominal, leasingNominal, cashUnit, leasingUnit, penaltyCount, tafsCount, accCount);
    renderCharts(aging, [cashNominal, leasingNominal]);
    updateSalesmanList(data);
}

function updateUI(os, overdue, penalty, lancar, cNom, lNom, cUnit, lUnit, pCount, tCount, aCount) {
    const fmt = (v) => "Rp " + Math.round(v).toLocaleString('id-ID');
    
    // Update KPI Card
    document.getElementById('total-os').innerText = fmt(os);
    document.getElementById('total-overdue').innerText = fmt(overdue);
    document.getElementById('total-penalty').innerText = fmt(penalty);
    document.getElementById('total-lancar').innerText = fmt(lancar);
    
    // Update Label Unit & SPK
    if(document.getElementById('count-penalty-label')) 
        document.getElementById('count-penalty-label').innerText = `DARI ${pCount} SPK`;
    
    document.getElementById('val-total-cash').innerText = fmt(cNom);
    document.getElementById('val-total-leasing').innerText = fmt(lNom);
    document.getElementById('unit-cash').innerText = cUnit + " Unit";
    document.getElementById('unit-leasing').innerText = lUnit + " Unit";

    // Update Breakdown Leasing TVC
    if(document.getElementById('total-unit-leasing-tvc')) 
        document.getElementById('total-unit-leasing-tvc').innerText = (tCount + aCount) + " Unit";
    if(document.getElementById('unit-tafs')) document.getElementById('unit-tafs').innerText = tCount + " Unit";
    if(document.getElementById('unit-acc')) document.getElementById('unit-acc').innerText = aCount + " Unit";

    // Update Progress Bar
    const pCash = (cNom / (cNom + lNom) * 100) || 0;
    document.getElementById('bar-cash').style.width = pCash + "%";
    document.getElementById('bar-leasing').style.width = (100 - pCash) + "%";
}

function renderCharts(aging, donutSeries) {
    if (chartAging) chartAging.destroy();
    if (chartDonut) chartDonut.destroy();

    // Pastikan Chart tidak digambar jika data kosong agar tidak error
    chartAging = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal', data: [aging.lancar, aging.h1_30, aging.h31_60, aging.over60] }],
        chart: { type: 'bar', height: 250, toolbar: {show: false} },
        colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 6, dataLabels: { position: 'top' } } },
        xaxis: { categories: ['LANCAR', '1-30 HR', '31-60 HR', '>60 HR'] },
        dataLabels: { enabled: true, formatter: (val) => (val/1000000).toFixed(1) + " Jt", style: { fontSize: '9px' } }
    });
    chartAging.render();

    chartDonut = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: donutSeries,
        chart: { type: 'donut', height: 250 },
        labels: ['CASH', 'LEASING'],
        colors: ['#10B981', '#2563EB'],
        plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: 'TOTAL UNIT', formatter: () => donutSeries[0] + donutSeries[1] } } } } }
    });
    chartDonut.render();
}

function updateSalesmanList(data) {
    const list = document.getElementById('list-salesman');
    if(!list) return;
    list.innerHTML = "";
    const salesData = data.reduce((acc, curr) => {
        acc[curr.salesman] = (acc[curr.salesman] || 0) + (parseFloat(curr.os_balance) || 0);
        return acc;
    }, {});

    Object.entries(salesData).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([name, val], i) => {
        list.innerHTML += `<div class="flex justify-between items-center text-[10px] py-1 border-b border-slate-50">
            <span class="font-bold text-slate-600">${i+1}. ${name}</span>
            <span class="font-black text-red-600">${(val/1000000).toFixed(1)} Jt</span>
        </div>`;
    });
}

supabase.channel('public:ar_unit').on('postgres_changes', { event: '*', schema: 'public', table: 'ar_unit' }, () => {
    loadDashboardData();
}).subscribe();

loadDashboardData();