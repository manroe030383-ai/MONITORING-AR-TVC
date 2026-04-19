import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) updateDashboard(data);
    } catch (e) { console.error(e); }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, unitCash: 0, unitLeas: 0, cOv: 0, gi: 0, rd: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mapLeasing = {}, mapSales = {}, mapOverdue = {}, mapSpv = {};

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();
        s.os += valOs;
        s.ov += Number(d.total_overdue || 0);
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);
        if (Number(d.total_overdue) > 0) s.cOv++;

        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        if (["CASH", "CASH TERIMA", ""].includes(lName)) {
            s.cash += valOs; s.unitCash++;
        } else {
            s.leas += valOs; s.unitLeas++;
            mapLeasing[lName] = (mapLeasing[lName] || 0) + valOs;
            if (d.gl_date) s.gi++; else s.rd++;
        }
        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        mapSpv[d.spv_name || 'N/A'] = (mapSpv[d.spv_name] || 0) + valOs;
        if (Number(d.total_overdue) > 0) mapOverdue[d.customer_name || 'CUST'] = (mapOverdue[d.customer_name] || 0) + Number(d.total_overdue);
    });

    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    document.getElementById('unit-total-cash').innerText = `${s.unitCash} Unit`;
    document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    document.getElementById('unit-total-leas').innerText = `${s.unitLeas} Unit`;
    document.getElementById('total-unit').innerText = `${s.unitLeas} Unit`;
    document.getElementById('unit-gi').innerText = s.gi;
    document.getElementById('unit-delivery').innerText = s.rd;
    document.getElementById('badge-overdue').innerText = `${s.cOv} SPK LEWAT TOP`;

    renderCharts(s.cash, s.leas, aging);
    renderLeasingList(mapLeasing, s.os);
    renderTopList('list-sales', mapSales, 'text-blue-600');
    renderTopList('list-overdue', mapOverdue, 'text-red-600');
    renderTopSpv(mapSpv);

    const cashPct = s.os > 0 ? (s.cash / s.os) * 100 : 0;
    document.getElementById('bar-cash').style.width = `${cashPct}%`;
    document.getElementById('bar-leasing').style.width = `${100 - cashPct}%`;
    document.getElementById('tgl-arsip').innerText = new Date().toLocaleDateString('id-ID');
    document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleTimeString()} WIB`;
}

function renderCharts(cash, leas, aging) {
    if (!charts.bar) {
        charts.bar = new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Juta', data: Object.values(aging) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            // WARNA BERBEDA UNTUK TIAP BATANG
            colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'], 
            plotOptions: { 
                bar: { 
                    borderRadius: 6, 
                    columnWidth: '45%', 
                    distributed: true // PAKSA WARNA BERBEDA TIAP BATANG
                } 
            },
            // MENGHILANGKAN ANGKA DI DALAM BATANG
            dataLabels: { enabled: false }, 
            xaxis: { 
                categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'],
                labels: { 
                    hideOverlappingLabels: false,
                    style: { fontSize: '9px', fontWeight: 700 } 
                } 
            },
            yaxis: { labels: { formatter: (v) => v + " Jt" } },
            legend: { show: false }, // Hilangkan legend karena label sumbu X sudah jelas
            grid: { borderColor: '#f1f5f9' }
        });
        charts.bar.render();
    } else { charts.bar.updateSeries([{ data: Object.values(aging) }]); }

    if (!charts.donut) {
        charts.donut = new ApexCharts(document.querySelector("#chart-donut-leasing"), {
            series: [cash, leas],
            labels: ['Cash', 'Leasing'],
            chart: { type: 'donut', height: 230 },
            colors: ['#10B981', '#2563EB'],
            stroke: { width: 0 },
            plotOptions: { pie: { donut: { size: '78%', labels: { show: false } } } },
            dataLabels: { enabled: false },
            legend: { position: 'bottom', fontSize: '10px', fontWeight: 600 }
        });
        charts.donut.render();
    } else { charts.donut.updateSeries([cash, leas]); }
}

function renderLeasingList(map, total) {
    document.getElementById('leasing-list').innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([n, v]) => `
        <div class="space-y-1"><div class="flex justify-between text-[9px] font-bold"><span class="text-slate-500">${n}</span><span class="text-slate-700">${((v/total)*100).toFixed(1)}%</span></div>
        <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div class="bg-blue-600 h-full" style="width: ${(v/total)*100}%"></div></div></div>`).join('');
}

function renderTopSpv(map) {
    document.getElementById('list-spv').innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5).map((item, i) => `
        <div class="flex justify-between items-center text-[9px] border-b border-slate-50 pb-2"><span class="font-bold text-slate-600 uppercase">${i+1}. ${item[0]}</span><span class="text-emerald-600 font-black">${fmtJuta(item[1])}</span></div>`).join('');
}

function renderTopList(id, map, colorClass) {
    document.getElementById(id).innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5).map((item, i) => `
        <div class="flex justify-between items-center text-[9px] border-b border-slate-50 pb-2"><span class="font-bold text-slate-600 uppercase truncate w-32">${i+1}. ${item[0]}</span><span class="${colorClass} font-black">${fmtJuta(item[1])}</span></div>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);//Refresh setiap 5 menit