import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// URL diperbaiki agar tidak ada spasi tersembunyi penyebab error
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const cleanNum = (val) => Number(String(val).replace(/[^0-9.-]+/g, "")) || 0;

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        
        const d = data || [];
        // Menjalankan semua fungsi dengan data yang sama
        updateDashboard(d);
        renderTables(d);
        updateExtraComponents(d);
        initAgingChart(d);
        initDashboardCharts(d); // Memanggil fungsi grafik baru
        
        console.log("Dashboard berhasil dimuat.");
    } catch (e) {
        console.error("Error data:", e);
    }
}

// Fungsi Grafik Donat & Batang
function initDashboardCharts(data) {
    let cashNominal = 0, leasNominal = 0, cashUnit = 0, leasUnit = 0;
    data.forEach(d => {
        const os = cleanNum(d.os_balance);
        const l = String(d.Leasing_Name || '').toUpperCase();
        if (l.includes('CASH') || l === '') { cashNominal += os; cashUnit++; } 
        else { leasNominal += os; leasUnit++; }
    });

    const elDonat = document.querySelector("#chart-donat-komposisi");
    const elBatang = document.querySelector("#chart-batang-nominal");

    if (elDonat) {
        new ApexCharts(elDonat, {
            series: [cashUnit, leasUnit],
            chart: { type: 'donut', height: 250 },
            labels: ['Cash', 'Leasing'],
            colors: ['#10B981', '#3B82F6']
        }).render();
    }
    
    if (elBatang) {
        new ApexCharts(elBatang, {
            series: [{ name: 'Nominal (Rp)', data: [cashNominal, leasNominal] }],
            chart: { type: 'bar', height: 250 },
            xaxis: { categories: ['Cash', 'Leasing'] },
            yaxis: { labels: { formatter: (v) => (v / 1000000000).toFixed(1) + ' M' } },
            colors: ['#10B981', '#3B82F6']
        }).render();
    }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, penalti: 0, lancar: 0, cash: 0, leas: 0, countCash: 0, countLeas: 0 };
    data.forEach(d => {
        s.os += cleanNum(d.os_balance);
        s.ov += cleanNum(d.total_overdue);
        s.penalti += cleanNum(d.Penalty_Amount);
        s.lancar += cleanNum(d.lancar);
        const l = String(d.Leasing_Name || '').toUpperCase();
        if (l.includes('CASH') || l === '') { s.cash += cleanNum(d.os_balance); s.countCash++; } 
        else { s.leas += cleanNum(d.os_balance); s.countLeas++; }
    });

    document.getElementById('total-os').innerText = 'Rp ' + s.os.toLocaleString('id-ID');
    document.getElementById('total-overdue').innerText = 'Rp ' + s.ov.toLocaleString('id-ID');
    document.getElementById('total-penalty').innerText = 'Rp ' + s.penalti.toLocaleString('id-ID');
    document.getElementById('total-lancar').innerText = 'Rp ' + s.lancar.toLocaleString('id-ID');
    document.getElementById('val-total-cash').innerText = 'Rp ' + s.cash.toLocaleString('id-ID');
    document.getElementById('unit-total-cash').innerText = s.countCash + ' Unit';
    document.getElementById('val-total-leas').innerText = 'Rp ' + s.leas.toLocaleString('id-ID');
    document.getElementById('unit-total-leas').innerText = s.countLeas + ' Unit';
    const total = s.os || 1;
    document.getElementById('bar-cash').style.width = ((s.cash / total) * 100) + '%';
    document.getElementById('bar-leasing').style.width = ((s.leas / total) * 100) + '%';
}

function renderTables(data) {
    const dbBody = document.getElementById('tab-database-body');
    if (dbBody) dbBody.innerHTML = data.map((d, i) => `<tr><td class="p-4 text-center">${i + 1}</td><td class="p-4 font-bold">${d.Customer_Name || '-'}</td><td class="p-4">${d.Leasing_Name || '-'}</td><td class="p-4 text-right">${Number(d.os_balance || 0).toLocaleString('id-ID')}</td><td class="p-4 text-right font-bold text-red-600">${Number(d.total_overdue || 0).toLocaleString('id-ID')}</td></tr>`).join('');
}

function updateExtraComponents(data) {
    const topOverdue = [...data].sort((a, b) => cleanNum(b.total_overdue) - cleanNum(a.total_overdue)).slice(0, 5);
    document.getElementById('list-overdue').innerHTML = topOverdue.map(d => `<div class="flex justify-between text-[10px] border-b border-slate-50 pb-2"><span class="truncate w-1/2 font-bold">${d.Customer_Name}</span><span class="text-red-600 font-bold">Rp ${cleanNum(d.total_overdue).toLocaleString('id-ID')}</span></div>`).join('');
    const topSales = [...data].sort((a, b) => cleanNum(b.os_balance) - cleanNum(a.os_balance)).slice(0, 5);
    document.getElementById('list-sales').innerHTML = topSales.map(d => `<div class="text-[10px] mb-2"><div class="font-bold">${d.Customer_Name}</div><div class="text-slate-400">Rp ${cleanNum(d.os_balance).toLocaleString('id-ID')}</div></div>`).join('');
    const tvc = data.filter(d => ['TAFS', 'ACC'].includes(d.Leasing_Name));
    document.getElementById('total-unit-tvc').innerText = tvc.length + ' Unit';
    document.getElementById('unit-gi-tvc').innerText = tvc.filter(d => d.Status_Aging === 'GI').length + ' Unit';
    document.getElementById('unit-delivery-tvc').innerText = tvc.filter(d => d.Status_Aging !== 'GI').length + ' Unit';
}

function initAgingChart(data) {
    const aging = { '1-30': 0, '31-60': 0, '>60': 0 };
    data.forEach(d => { aging['1-30'] += cleanNum(d.hari_1_30); aging['31-60'] += cleanNum(d.hari_31_60); aging['>60'] += cleanNum(d.lebih_60_hari); });
    const el = document.querySelector("#chart-aging");
    if (el) new ApexCharts(el, { series: [{ name: 'Nominal', data: [aging['1-30'], aging['31-60'], aging['>60']] }], chart: { type: 'bar', height: 250 }, xaxis: { categories: ['1-30 Hari', '31-60 Hari', '> 60 Hari'] } }).render();
}

document.addEventListener('DOMContentLoaded', fetchData);