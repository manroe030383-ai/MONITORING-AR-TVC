import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const cleanNum = (val) => Number(String(val).replace(/[^0-9.-]+/g, "")) || 0;

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) {
            updateDashboard(data);
            renderAllTabs(data);
            updateExtraComponents(data);
            initCharts(data);
            document.getElementById('status-update').innerText = "DATA TERBARU: " + new Date().toLocaleTimeString();
        }
    } catch (e) { console.error("Error:", e); }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, penalti: 0, lancar: 0, cash: 0, leas: 0 };
    data.forEach(d => {
        s.os += cleanNum(d.os_balance); s.ov += cleanNum(d.total_overdue); 
        s.penalti += cleanNum(d.Penalty_Amount); s.lancar += cleanNum(d.lancar);
        const l = String(d.Leasing_Name || '').toUpperCase();
        if (l.includes('CASH') || l === '') s.cash += cleanNum(d.os_balance); 
        else s.leas += cleanNum(d.os_balance);
    });
    document.getElementById('total-os').innerText = 'Rp ' + s.os.toLocaleString('id-ID');
    document.getElementById('total-overdue').innerText = 'Rp ' + s.ov.toLocaleString('id-ID');
    document.getElementById('total-penalty').innerText = 'Rp ' + s.penalti.toLocaleString('id-ID');
    document.getElementById('total-lancar').innerText = 'Rp ' + s.lancar.toLocaleString('id-ID');
    document.getElementById('bar-cash').style.width = ((s.cash / (s.os || 1)) * 100) + '%';
    document.getElementById('bar-leasing').style.width = ((s.leas / (s.os || 1)) * 100) + '%';
}

function renderAllTabs(data) {
    // Database Lengkap
    document.getElementById('tab-database-body').innerHTML = data.map((d, i) => 
        `<tr><td class="p-2 border-b">${i+1}</td><td class="p-2 border-b font-bold">${d.Customer_Name}</td><td class="p-2 border-b">${d.Leasing_Name}</td><td class="p-2 border-b">Rp ${cleanNum(d.os_balance).toLocaleString()}</td></tr>`).join('');

    // Leasing
    const lMap = data.reduce((a, d) => { a[d.Leasing_Name] = (a[d.Leasing_Name] || 0) + cleanNum(d.os_balance); return a; }, {});
    document.getElementById('content-leasing').innerHTML = `<div class="bg-white p-6 rounded-2xl border card-shadow"><h4 class="text-[10px] font-bold text-slate-400 mb-4">DETAIL LEASING</h4><table class="w-full text-xs">${Object.entries(lMap).map(([k, v]) => `<tr><td class="p-2 border-b">${k}</td><td class="p-2 border-b font-bold">Rp ${v.toLocaleString()}</td></tr>`).join('')}</table></div>`;

    // Overdue
    document.getElementById('content-overdue').innerHTML = `<div class="bg-white p-6 rounded-2xl border card-shadow"><h4 class="text-[10px] font-bold text-slate-400 mb-4">DATA OVERDUE</h4><table class="w-full text-xs">${data.filter(d => cleanNum(d.total_overdue) > 0).map(d => `<tr><td class="p-2 border-b">${d.Customer_Name}</td><td class="p-2 border-b text-red-600 font-bold">Rp ${cleanNum(d.total_overdue).toLocaleString()}</td></tr>`).join('')}</table></div>`;
}

function updateExtraComponents(data) {
    const topSales = [...data].sort((a,b) => cleanNum(b.os_balance) - cleanNum(a.os_balance)).slice(0, 5);
    document.getElementById('list-sales').innerHTML = topSales.map(d => `<div class="text-[10px] mb-2 font-bold">${d.Customer_Name}<div class="text-slate-400">Rp ${cleanNum(d.os_balance).toLocaleString()}</div></div>`).join('');
    
    const tvc = data.filter(d => ['TAFS', 'ACC'].includes(d.Leasing_Name));
    document.getElementById('total-unit-tvc').innerText = tvc.length + ' Unit';
    
    const topOverdue = [...data].sort((a,b) => cleanNum(b.total_overdue) - cleanNum(a.total_overdue)).slice(0, 5);
    document.getElementById('list-overdue').innerHTML = topOverdue.map(d => `<div class="flex justify-between text-[10px] mb-2 font-bold">${d.Customer_Name}<span class="text-red-600">Rp ${cleanNum(d.total_overdue).toLocaleString()}</span></div>`).join('');
    
    const spvMap = data.reduce((a, d) => { const n = d.Supervisor_Name || 'OFFICE'; a[n] = (a[n] || 0) + cleanNum(d.os_balance); return a; }, {});
    document.getElementById('list-spv').innerHTML = Object.entries(spvMap).sort((a,b) => b[1]-a[1]).slice(0,5).map(d => `<div class="flex justify-between text-[10px] mb-2 font-bold">${d[0]}<span class="text-purple-600">Rp ${(d[1]/1000000).toFixed(1)}Jt</span></div>`).join('');
}

function initCharts(data) {
    // Aging
    const aging = { '1-30': 0, '31-60': 0, '>60': 0 };
    data.forEach(d => { aging['1-30'] += cleanNum(d.hari_1_30); aging['31-60'] += cleanNum(d.hari_31_60); aging['>60'] += cleanNum(d.lebih_60_hari); });
    new ApexCharts(document.querySelector("#chart-aging"), { series: [{data: [aging['1-30'], aging['31-60'], aging['>60']]}], chart: { type: 'bar', height: 250 }, xaxis: { categories: ['1-30', '31-60', '>60'] } }).render();
}

document.addEventListener('DOMContentLoaded', fetchData);