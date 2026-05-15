import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*').order('os_balance', { ascending: false });
        if (error) throw error;
        if (data) updateDashboard(data);
    } catch (e) { console.error(e); }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, countOv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {};

    data.forEach(d => {
        const os = Number(d.os_balance || 0);
        const ov = Number(d.total_overdue || 0);
        const l = (d.leasing_name || 'CASH').toUpperCase().trim();
        s.os += os; s.ov += ov; s.pen += Number(d.penalty_amount || 0); s.lan += Number(d.lancar || 0);
        if (ov > 0) s.countOv++;

        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        if (["CASH", "CASH TERIMA", ""].includes(l)) s.cash += os;
        else { s.leas += os; mLeas[l] = (mLeas[l] || 0) + os; }
        mSales[d.salesman_name || 'N/A'] = (mSales[d.salesman_name] || 0) + os;
        mSpv[d.spv_name || 'N/A'] = (mSpv[d.spv_name] || 0) + os;
    });

    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('badge-overdue').innerText = `${s.countOv} SPK LEWAT TOP`;
    document.getElementById('bar-cash').style.width = `${(s.cash/s.os)*100}%`;
    document.getElementById('bar-leasing').style.width = `${(s.leas/s.os)*100}%`;

    renderAgingChart(aging);
    renderLeasingList(mLeas, s.os);
    renderTop(mSales, 'list-sales', 'text-blue-600');
    renderTop(mSpv, 'list-spv', 'text-purple-600');
    renderTabLeasing(data);
    renderTabOverdue(data);
    renderTabDatabase(data);
}

function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging");
    const options = {
        series: [{ name: 'Juta', data: Object.values(agingData).map(v => Math.round(v)) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: (v) => v + " Jt", style: { fontSize: '9px' }, offsetY: -20 },
        xaxis: { categories: Object.keys(agingData), labels: { style: { fontSize: '9px', fontWeight: 700 } } },
        yaxis: { show: false }
    };
    if (charts.bar) charts.bar.updateOptions(options);
    else { charts.bar = new ApexCharts(el, options); charts.bar.render(); }
}

function renderLeasingList(map, total) {
    document.getElementById('leasing-list').innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([n, v]) => `
        <div class="mb-2">
            <div class="flex justify-between text-[9px] font-bold mb-1"><span>${n}</span><span>${((v/total)*100).toFixed(1)}%</span></div>
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div class="bg-blue-600 h-full" style="width: ${(v/total)*100}%"></div></div>
        </div>`).join('');
}

function renderTop(map, id, color) {
    document.getElementById(id).innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map((x,i) => `
        <div class="flex justify-between text-[10px] py-1.5 border-b border-slate-50 uppercase font-bold">
            <span class="text-slate-600 truncate w-32">${i+1}. ${x[0]}</span><span class="${color}">${fmtJuta(x[1])}</span>
        </div>`).join('');
}

function renderTabLeasing(data) {
    const groups = data.reduce((acc, d) => {
        const l = (d.leasing_name || 'CASH').toUpperCase();
        if(!acc[l]) acc[l] = []; acc[l].push(d); return acc;
    }, {});
    document.getElementById('tab-leasing-list').innerHTML = Object.entries(groups).map(([n, items]) => `
        <div class="bg-white p-4 rounded-xl border border-slate-100 card-shadow">
            <h5 class="text-[10px] font-black text-blue-700 uppercase mb-3">${n}</h5>
            ${items.slice(0,5).map(i => `<div class="flex justify-between text-[9px] mb-1"><span>${i.customer_name}</span><b>${fmtIDR(i.os_balance)}</b></div>`).join('')}
        </div>`).join('');
}

function renderTabOverdue(data) {
    document.getElementById('tab-overdue-list').innerHTML = data.filter(d=>d.total_overdue>0).map(d => `
        <div class="bg-red-50 p-3 rounded-lg flex justify-between text-[10px] font-bold border border-red-100 text-red-700 uppercase">
            <span>${d.customer_name}</span><span>${fmtIDR(d.total_overdue)}</span>
        </div>`).join('');
}

function renderTabDatabase(data) {
    document.getElementById('tab-database-body').innerHTML = data.map((d,i) => `
        <tr class="border-b border-slate-50 text-slate-700">
            <td class="p-3 text-center">${i+1}</td>
            <td class="p-3 font-bold uppercase">${d.customer_name}</td>
            <td class="p-3 uppercase">${d.leasing_name || 'CASH'}</td>
            <td class="p-3 text-right font-bold text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-3 text-right font-bold text-red-500">${fmtIDR(d.total_overdue)}</td>
            <td class="p-3 uppercase text-slate-400">${d.salesman_name}</td>
        </tr>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);