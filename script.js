import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

async function fetchData() {
    const { data, error } = await supabase.from('ar_unit').select('*');
    if (data) updateDashboard(data);
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let tvc = { total: 0, gi: 0, delivery: 0, acc: 0, tafs: 0 };
    let mapSales = {}, mapOverdue = {}, mapSpv = {}, mapSpvUnits = {};

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase();
        
        s.os += valOs;
        s.ov += Number(d.total_overdue || 0);
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);

        // Filter TVC (ACC & TAFS)
        if (lName.includes('ACC') || lName.includes('TAFS')) {
            tvc.total++;
            if (d.gl_date) tvc.gi++; else tvc.delivery++;
            if (lName.includes('ACC')) tvc.acc++;
            if (lName.includes('TAFS')) tvc.tafs++;
        }

        // Komposisi Cash vs Leas
        if (lName === 'CASH') s.cash += valOs; else s.leas += valOs;

        // Aging
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        mapSpv[d.spv_name || 'N/A'] = (mapSpv[d.spv_name] || 0) + valOs;
        mapSpvUnits[d.spv_name || 'N/A'] = (mapSpvUnits[d.spv_name] || 0) + 1;
        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        if (Number(d.total_overdue) > 0) mapOverdue[d.customer_name] = (mapOverdue[d.customer_name] || 0) + Number(d.total_overdue);
    });

    // Update UI TVC
    document.getElementById('tvc-total-unit').innerText = `${tvc.total} Unit`;
    document.getElementById('tvc-gi').innerText = `${tvc.gi} Unit`;
    document.getElementById('tvc-delivery').innerText = `${tvc.delivery} Unit`;
    document.getElementById('list-tvc-detail').innerHTML = `
        <div class="flex justify-between p-2 bg-slate-50 rounded-lg text-[9px] font-bold"><span>1. ACC</span><span class="bg-yellow-400 px-2 rounded">${tvc.acc} Cust</span></div>
        <div class="flex justify-between p-2 bg-slate-50 rounded-lg text-[9px] font-bold"><span>2. TAFS</span><span class="bg-yellow-400 px-2 rounded">${tvc.tafs} Cust</span></div>`;

    // Update UI SPV Distribution (Progress Bar Ungu)
    document.getElementById('list-spv-dist').innerHTML = Object.entries(mapSpv).sort((a,b) => b[1]-a[1]).map(([name, val]) => {
        const pct = ((val/s.os)*100).toFixed(1);
        return `<div class="space-y-1"><div class="flex justify-between text-[9px] font-bold uppercase"><span>${name}</span><span class="text-indigo-600">${fmtJuta(val)}</span></div>
        <div class="flex items-center gap-2"><div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div class="bg-purple-500 h-full" style="width:${pct}%"></div></div>
        <span class="text-[8px] font-bold text-slate-400">${pct}% • ${mapSpvUnits[name]} Unit</span></div></div>`;
    }).join('');

    // List Sales & Overdue
    document.getElementById('list-sales').innerHTML = Object.entries(mapSales).sort((a,b) => b[1]-a[1]).slice(0,5).map((x,i) => `<div class="flex justify-between text-[9px] border-b pb-1"><span>${i+1}. ${x[0]}</span><span class="font-bold text-blue-600">${fmtJuta(x[1])}</span></div>`).join('');
    document.getElementById('list-overdue').innerHTML = Object.entries(mapOverdue).sort((a,b) => b[1]-a[1]).slice(0,5).map((x,i) => `<div class="flex justify-between text-[9px] border-b pb-1"><span>${i+1}. ${x[0]}</span><span class="font-bold text-red-600">${fmtJuta(x[1])}</span></div>`).join('');

    renderCharts(s.cash, s.leas, aging);
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    
    const cashPct = (s.cash / s.os) * 100;
    document.getElementById('bar-cash').style.width = cashPct + '%';
    document.getElementById('bar-leasing').style.width = (100 - cashPct) + '%';
    document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleTimeString()} WIB`;
}

function renderCharts(cash, leas, aging) {
    // Grafik Aging - Warna beda, Tanpa Angka
    new ApexCharts(document.querySelector("#chart-aging"), {
        series: [{ name: 'Juta', data: Object.values(aging) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'], 
        plotOptions: { bar: { borderRadius: 4, distributed: true, columnWidth: '50%' } },
        dataLabels: { enabled: false },
        xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'], labels: { style: { fontSize: '9px', fontWeight: 700 } } },
        legend: { show: false }
    }).render();

    // Grafik Donut
    new ApexCharts(document.querySelector("#chart-donut-leasing"), {
        series: [cash, leas],
        labels: ['Cash', 'Leasing'],
        chart: { type: 'donut', height: 230 },
        colors: ['#10B981', '#2563EB'],
        plotOptions: { pie: { donut: { size: '75%' } } },
        dataLabels: { enabled: false },
        legend: { position: 'bottom' }
    }).render();
}

document.addEventListener('DOMContentLoaded', fetchData);