import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// State management sederhana agar chart tidak perlu destroy/re-render total
let charts = { donut: null, bar: null };

const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const formatJuta = (n) => (Number(n) / 1000000).toFixed(1) + " Jt";

async function loadData() {
    const statusText = document.getElementById('tgl-update-text');
    try {
        statusText.innerText = "REFRESHING DATA...";
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        
        processDashboard(data);
    } catch (err) { 
        console.error("Fetch Error:", err);
        statusText.innerText = "CONNECTION FAILED";
        statusText.classList.add('text-red-600');
    }
}

function processDashboard(data) {
    // 1. Initial Accumulators
    const stats = {
        tOS: 0, tOverdue: 0, tPenalty: 0, tLancar: 0,
        cashNom: 0, leasingNom: 0, cOverdue: 0,
        uACC: 0, uTAFS: 0, uGI: 0, uRD: 0
    };
    
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    const maps = { sales: {}, ov: {}, spv: {}, leasing: {} };

    // 2. Single-Pass Data Processing (Lebih Cepat)
    data.forEach(d => {
        const os = Number(d.os_balance || 0);
        const ov = Number(d.total_overdue || d.total_overd || 0);
        const lName = (d.leasing_name || '').toUpperCase().trim();
        
        stats.tOS += os;
        stats.tOverdue += ov;
        if (ov > 0) {
            stats.cOverdue++;
            maps.ov[d.customer_name] = (maps.ov[d.customer_name] || 0) + ov;
        }
        
        stats.tLancar += Number(d.lancar || 0);
        stats.tPenalty += Number(d.penalty_amount || 0);

        // Aging Buckets
        buckets['LANCAR'] += Number(d.lancar || 0) / 1000000;
        buckets['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        buckets['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        buckets['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        // Grouping logic
        maps.sales[d.salesman_name] = (maps.sales[d.salesman_name] || 0) + os;
        maps.spv[d.spv_name || 'N/A'] = (maps.spv[d.spv_name] || 0) + os;

        if (["CASH", "CASH TERIMA", ""].includes(lName)) {
            stats.cashNom += os;
        } else {
            stats.leasingNom += os;
            maps.leasing[lName] = (maps.leasing[lName] || 0) + os;
            if (lName.includes("ACC")) stats.uACC++;
            if (lName.includes("TAFS")) stats.uTAFS++;
            // Logika GI/RD yang lebih solid
            if (d.gl_date && d.gl_date !== "0" && d.gl_date !== "null") stats.uGI++; else stats.uRD++;
        }
    });

    // 3. UI Updates
    renderUI(stats);
    renderLists(maps);
    updateCharts(stats.cashNom, stats.leasingNom, Object.values(buckets));
    renderLeasingBreakdown(maps.leasing, stats.tOS);
    
    // 4. Timestamp
    const now = new Date();
    document.getElementById('tgl-arsip').innerText = now.toLocaleDateString('id-ID');
    document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${now.toLocaleTimeString('id-ID')} WIB`;
    document.getElementById('tgl-update-text').classList.remove('animate-pulse');
}

function renderUI(s) {
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    set('total-os', formatIDR(s.tOS));
    set('total-overdue', formatIDR(s.tOverdue));
    set('count-overdue-spk', `${s.cOverdue} SPK OVERDUE`);
    set('total-penjualan-leasing', `${s.uACC + s.uTAFS} Unit`);
    set('unit-sudah-gi', s.uGI);
    set('unit-r-delivery', s.uRD);
    set('total-lancar', formatIDR(s.tLancar));
    set('total-penalty', formatIDR(s.tPenalty));
    
    document.getElementById('bar-cash').style.width = `${(s.cashNom/s.tOS)*100}%`;
    document.getElementById('bar-leasing').style.width = `${(s.leasingNom/s.tOS)*100}%`;
}

function updateCharts(cash, leasing, aging) {
    // Donut Chart logic
    if (!charts.donut) {
        charts.donut = new ApexCharts(document.querySelector("#chart-donut-main"), {
            series: [cash, leasing], labels: ['Cash', 'Leasing'],
            chart: { type: 'donut', height: 220 },
            colors: ['#10B981', '#2563EB'],
            legend: { position: 'bottom' },
            dataLabels: { enabled: false }
        });
        charts.donut.render();
    } else {
        charts.donut.updateSeries([cash, leasing]);
    }

    // Bar Chart logic
    if (!charts.bar) {
        charts.bar = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
            series: [{ name: 'Juta', data: aging }],
            chart: { type: 'bar', height: 220, toolbar: {show: false} },
            colors: ['#4318FF'],
            plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
            xaxis: { categories: ['LANCAR', '1-30H', '31-60H', '>60H'] }
        });
        charts.bar.render();
    } else {
        charts.bar.updateSeries([{ data: aging }]);
    }
}

function renderLists(maps) {
    const createItems = (map, color) => Object.entries(map)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 5)
        .map((s, i) => `
            <div class="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                <span class="text-[9px] font-bold text-slate-600 truncate w-28">${i+1}. ${s[0]}</span>
                <span class="text-${color}-600 font-black text-[10px]">${formatJuta(s[1])}</span>
            </div>`).join('');

    document.getElementById('list-salesman').innerHTML = createItems(maps.sales, 'blue');
    document.getElementById('list-overdue').innerHTML = createItems(maps.ov, 'red');
    document.getElementById('list-spv').innerHTML = createItems(maps.spv, 'emerald');
}

function renderLeasingBreakdown(leasingMap, totalOS) {
    document.getElementById('leasing-breakdown-list').innerHTML = Object.entries(leasingMap)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 4)
        .map(l => {
            const pct = ((l[1]/totalOS)*100).toFixed(1);
            return `
            <div class="space-y-1">
                <div class="flex justify-between text-[9px] font-bold text-slate-500">
                    <span>${l[0]}</span><span>${pct}%</span>
                </div>
                <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-blue-600 h-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
            </div>`;
        }).join('');
}

// Auto-Refresh tiap 5 menit
document.addEventListener('DOMContentLoaded', loadData);
setInterval(loadData, 300000);