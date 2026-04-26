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
    } catch (e) { console.error("Error Fetching:", e); }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, unitCash: 0, unitLeas: 0, cOv: 0, spkPenCount: 0 };
    let tvc = { totalUnit: 0, gi: 0, rd: 0 };
    let mapTvcDetail = { 'TAFS': 0, 'ACC': 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mapLeasing = {}, mapSales = {}, mapOverdue = {}, mapSpv = {};

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();
        const spvName = d.spv_name || 'N/A';
        
        s.os += valOs;
        s.ov += Number(d.total_overdue || 0);
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);
        
        if (Number(d.penalty_amount) > 0) s.spkPenCount++;
        if (Number(d.total_overdue) > 0) s.cOv++;

        // Aging Logic
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        // Cash vs Leasing Logic
        if (["CASH", "CASH TERIMA", ""].includes(lName)) {
            s.cash += valOs; s.unitCash++;
        } else {
            s.leas += valOs; s.unitLeas++;
            mapLeasing[lName] = (mapLeasing[lName] || 0) + valOs;
            
            // TVC Logic (TAFS & ACC ONLY)
            if (lName === 'TAFS' || lName === 'ACC') {
                tvc.totalUnit++;
                if (d.gl_date) tvc.gi++; else tvc.rd++;
                mapTvcDetail[lName]++;
            }
        }

        // SPV Mapping (Nominal & Unit)
        if (!mapSpv[spvName]) mapSpv[spvName] = { nominal: 0, unit: 0 };
        mapSpv[spvName].nominal += valOs;
        mapSpv[spvName].unit += 1;

        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        if (Number(d.total_overdue) > 0) {
            mapOverdue[d.customer_name || 'CUST'] = (mapOverdue[d.customer_name] || 0) + Number(d.total_overdue);
        }
    });

    // Update Global Stats
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    document.getElementById('unit-total-cash').innerText = `${s.unitCash} Unit`;
    document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    document.getElementById('unit-total-leas').innerText = `${s.unitLeas} Unit`;
    
    // Update TVC Section
    document.getElementById('total-unit-tvc').innerText = `${tvc.totalUnit} Unit`;
    document.getElementById('unit-gi-tvc').innerText = `${tvc.gi} Unit`;
    document.getElementById('unit-delivery-tvc').innerText = `${tvc.rd} Unit`;
    
    document.getElementById('spk-penalty').innerText = `${s.spkPenCount} SPK`;
    document.getElementById('badge-overdue').innerText = `${s.cOv} SPK LEWAT TOP`;

    const now = new Date();
    document.getElementById('status-update').innerText = `DATA UPDATE: ${now.toLocaleString('id-ID')}`;

    renderCharts(s.cash, s.leas, aging);
    renderLeasingList(mapLeasing, s.os);
    renderTopList('list-sales', mapSales, 'text-blue-600');
    renderTopList('list-overdue', mapOverdue, 'text-red-600');
    renderTvcList(mapTvcDetail);
    renderTopSpv(mapSpv, s.os);

    const cashPct = s.os > 0 ? (s.cash / s.os) * 100 : 0;
    document.getElementById('bar-cash').style.width = `${cashPct}%`;
    document.getElementById('bar-leasing').style.width = `${100 - cashPct}%`;
}

function renderCharts(cash, leas, aging) {
    if (!charts.bar) {
        charts.bar = new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Juta', data: Object.values(aging) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
            plotOptions: { bar: { borderRadius: 4, columnWidth: '50%', distributed: true } },
            xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'], labels: { style: { fontSize: '9px', fontWeight: 700 } } },
            legend: { show: false }
        });
        charts.bar.render();
    } else { charts.bar.updateSeries([{ data: Object.values(aging) }]); }

    if (!charts.donut) {
        charts.donut = new ApexCharts(document.querySelector("#chart-donut-leasing"), {
            series: [cash, leas],
            labels: ['Cash', 'Leasing'],
            chart: { type: 'donut', height: 230 },
            colors: ['#10B981', '#2563EB'],
            legend: { position: 'bottom' }
        });
        charts.donut.render();
    } else { charts.donut.updateSeries([cash, leas]); }
}

function renderTvcList(map) {
    const target = ['TAFS', 'ACC'];
    document.getElementById('tvc-detail-list').innerHTML = target.map(name => `
        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 py-2">
            <span class="font-bold text-slate-500 uppercase">${name}</span>
            <span class="font-black text-blue-600 text-xs">${map[name] || 0} Unit</span>
        </div>`).join('');
}

// TOP SPV RENDERER (Sesuai Referensi)
function renderTopSpv(map, totalOs) {
    const sorted = Object.entries(map).sort((a, b) => b[1].nominal - a[1].nominal).slice(0, 5);
    document.getElementById('list-spv').innerHTML = sorted.map(([name, data], i) => {
        const pct = totalOs > 0 ? ((data.nominal / totalOs) * 100).toFixed(1) : 0;
        return `
        <div class="space-y-1">
            <div class="flex justify-between items-center">
                <span class="text-[11px] font-extrabold text-slate-700 uppercase truncate w-40">${i+1}. ${name}</span>
                <span class="text-[#6D28D9] font-black text-[11px]">${fmtJuta(data.nominal)}</span>
            </div>
            <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                <div class="absolute h-full bg-[#A855F7] rounded-full" style="width: ${pct}%"></div>
            </div>
            <div class="flex justify-end gap-2 text-[9px] font-bold text-slate-400">
                <span>${pct}% Global</span>
                <span>•</span>
                <span class="text-[#6D28D9]">${data.unit} Unit</span>
            </div>
        </div>`;
    }).join('');
}

function renderTopList(id, map, colorClass) {
    document.getElementById(id).innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5).map((item, i) => `
        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 pb-2">
            <span class="font-bold text-slate-600 uppercase truncate w-32">${i+1}. ${item[0]}</span>
            <span class="${colorClass} font-black text-xs">${fmtJuta(item[1])}</span>
        </div>`).join('');
}

function renderLeasingList(map, total) {
    document.getElementById('leasing-list').innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([n, v]) => `
        <div class="space-y-1">
            <div class="flex justify-between text-[9px] font-bold"><span class="text-slate-500">${n}</span><span class="text-slate-700">${((v/total)*100).toFixed(1)}%</span></div>
            <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div class="bg-blue-600 h-full" style="width: ${(v/total)*100}%"></div></div>
        </div>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);