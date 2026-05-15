import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Kredensial Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};

// Helper Format Angka
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

// --- FUNGSI NAVIGASI TAB ---
window.filterTab = function(btn, tabName) {
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('nav-active');
        b.classList.add('bg-white', 'text-slate-500');
    });
    btn.classList.add('nav-active');
    btn.classList.remove('bg-white', 'text-slate-500');

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`content-${tabName}`).classList.remove('hidden');

    if (tabName === 'ringkasan') {
        window.dispatchEvent(new Event('resize'));
    }
};

// 2. Fungsi Utama Ambil Data
async function fetchData() {
    try {
        const statusEl = document.getElementById('status-update');
        statusEl.innerText = "MENYINKRONKAN DATA...";

        const { data, error } = await supabase.from('ar_unit').select('*');
        
        if (error) throw error;

        if (data && data.length > 0) {
            updateDashboard(data);
            statusEl.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
            statusEl.className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
        } else {
            statusEl.innerText = "DATA KOSONG DI SUPABASE";
        }
    } catch (e) {
        console.error("Detail Error:", e);
        document.getElementById('status-update').innerText = "ERROR: PERIKSA KONEKSI";
    }
}

// 3. Logika Perhitungan Dashboard
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, unitCash: 0, unitLeas: 0, cOv: 0, spkPenCount: 0 };
    let tvc = { totalUnit: 0, gi: 0, rd: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mapTvcDetail = { 'TAFS': 0, 'ACC': 0 };
    let mapLeasing = {}, mapSales = {}, mapOverdue = {}, mapSpv = {};

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const valOv = Number(d.total_overdue || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();
        
        s.os += valOs;
        s.ov += valOv;
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);
        
        if (Number(d.penalty_amount) > 0) s.spkPenCount++;
        if (valOv > 0) s.cOv++;

        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        if (["CASH", "CASH TERIMA", ""].includes(lName)) {
            s.cash += valOs; s.unitCash++;
        } else {
            s.leas += valOs; s.unitLeas++;
            mapLeasing[lName] = (mapLeasing[lName] || 0) + valOs;
            
            if (lName === 'TAFS' || lName === 'ACC') {
                tvc.totalUnit++;
                if (d.gl_date) tvc.gi++; else tvc.rd++;
                mapTvcDetail[lName]++;
            }
        }

        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        mapSpv[d.spv_name || 'N/A'] = (mapSpv[d.spv_name] || 0) + valOs;
        
        if (valOv > 0) {
            mapOverdue[d.customer_name || 'CUST'] = (mapOverdue[d.customer_name] || 0) + valOv;
        }
    });

    // Update Tampilan Ringkasan
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    document.getElementById('unit-total-cash').innerText = `${s.unitCash} Unit`;
    document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    document.getElementById('unit-total-leas').innerText = `${s.unitLeas} Unit`;
    document.getElementById('total-unit-tvc').innerText = `${tvc.totalUnit} Unit`;
    document.getElementById('unit-gi-tvc').innerText = `${tvc.gi} Unit`;
    document.getElementById('unit-delivery-tvc').innerText = `${tvc.rd} Unit`;
    document.getElementById('spk-penalty').innerText = `${s.spkPenCount} SPK`;
    document.getElementById('badge-overdue').innerText = `${s.cOv} SPK LEWAT TOP`;

    // --- RENDER ISI TAB (DIPERBAIKI) ---
    renderLeasingTabTable(mapLeasing); 
    renderOverdueTabTable(data);       
    renderFullDatabaseTable(data);     

    // Visual Charts & Mini Lists
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

// --- FUNGSI RENDERER TAB ---

function renderLeasingTabTable(mapLeasing) {
    const el = document.getElementById('tab-leasing-list');
    if (!el) return;
    
    // Tampilan Kartu (Grid)
    el.innerHTML = Object.entries(mapLeasing).sort((a,b) => b[1]-a[1]).map(([name, val]) => `
        <div class="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <div>
                <p class="text-[8px] font-bold text-slate-400 uppercase">Partner Leasing</p>
                <p class="font-bold text-slate-700 uppercase text-[10px] leading-tight">${name}</p>
            </div>
            <div class="text-right">
                <p class="text-[8px] font-bold text-blue-400 uppercase">O/S Balance</p>
                <p class="font-black text-blue-600 text-xs">${fmtIDR(val)}</p>
            </div>
        </div>`).join('');
}

function renderOverdueTabTable(data) {
    const el = document.getElementById('tab-overdue-list');
    if (!el) return;
    
    const overdueData = data.filter(d => Number(d.total_overdue) > 0).sort((a,b) => b.total_overdue - a.total_overdue);
    
    if (overdueData.length === 0) {
        el.innerHTML = '<p class="text-center py-10 text-slate-400 text-[10px] italic">Tidak ada data overdue.</p>';
        return;
    }

    el.innerHTML = overdueData.map(d => `
        <div class="flex justify-between items-center p-4 border-b border-red-50 bg-red-50/10 hover:bg-red-50/30 transition-all rounded-lg mb-1">
            <div>
                <p class="font-bold text-slate-800 uppercase text-[10px]">${d.customer_name}</p>
                <p class="text-[8px] text-slate-400 uppercase font-medium">
                    ${d.leasing_name || 'CASH'} <span class="mx-1 text-slate-200">|</span> Sales: ${d.salesman_name}
                </p>
            </div>
            <div class="text-right">
                <p class="font-black text-red-600 text-xs leading-none">${fmtIDR(d.total_overdue)}</p>
                <p class="text-[7px] font-bold text-red-400 uppercase mt-1 italic">Retail Debt</p>
            </div>
        </div>`).join('');
}

function renderFullDatabaseTable(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;
    el.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50 border-b border-slate-50 transition-colors">
            <td class="p-3 text-slate-300 font-bold text-center">${i+1}</td>
            <td class="p-3">
                <p class="font-bold uppercase text-slate-700 leading-tight">${d.customer_name || '-'}</p>
                <p class="text-[8px] text-slate-400 uppercase">${d.spk_number || ''}</p>
            </td>
            <td class="p-3 uppercase text-slate-500 font-medium text-[9px]">${d.leasing_name || 'CASH'}</td>
            <td class="p-3 font-bold text-blue-600 text-right">${fmtIDR(d.os_balance)}</td>
            <td class="p-3 font-bold text-red-500 text-right">${fmtIDR(d.total_overdue)}</td>
            <td class="p-3 uppercase text-slate-400 text-[9px] italic">${d.salesman_name || 'N/A'}</td>
        </tr>`).join('');
}

// --- FUNGSI CHART & LIST KECIL ---
function renderCharts(cash, leas, aging) {
    if (!charts.bar) {
        charts.bar = new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Nominal (Jt)', data: Object.values(aging) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
            plotOptions: { bar: { borderRadius: 4, columnWidth: '50%', distributed: true } },
            xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'], labels: { style: { fontSize: '9px', fontWeight: 700 } } },
            yaxis: { labels: { formatter: (v) => v + " Jt" } },
            dataLabels: { enabled: false }
        });
        charts.bar.render();
    } else { charts.bar.updateSeries([{ data: Object.values(aging) }]); }

    if (!charts.donut) {
        charts.donut = new ApexCharts(document.querySelector("#chart-donut-leasing"), {
            series: [cash, leas],
            labels: ['Cash', 'Leasing'],
            chart: { type: 'donut', height: 230 },
            colors: ['#10B981', '#2563EB'],
            stroke: { show: false },
            plotOptions: { pie: { donut: { size: '75%', labels: { show: true, total: { show: true, label: 'TOTAL O/S', formatter: () => fmtJuta(cash+leas) } } } } },
            legend: { position: 'bottom', fontSize: '10px', fontWeight: 700 }
        });
        charts.donut.render();
    } else { charts.donut.updateSeries([cash, leas]); }
}

function renderTopList(id, map, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5).map((item, i) => `
        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 py-2.5">
            <span class="font-bold text-slate-600 uppercase truncate w-32">${i+1}. ${item[0]}</span>
            <span class="${colorClass} font-black text-xs">${fmtJuta(item[1])}</span>
        </div>`).join('');
}

function renderTopSpv(map, total) {
    const el = document.getElementById('list-spv');
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5).map((item, i) => {
        const pct = total > 0 ? ((item[1] / total) * 100).toFixed(1) : 0;
        return `
        <div class="space-y-1 mb-3">
            <div class="flex justify-between text-[10px] font-bold">
                <span class="text-slate-600 uppercase truncate w-32">${i+1}. ${item[0]}</span>
                <span class="text-purple-600 font-black text-xs">${fmtJuta(item[1])}</span>
            </div>
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                <div class="bg-purple-500 h-full" style="width: ${pct}%"></div>
            </div>
        </div>`;
    }).join('');
}

function renderLeasingList(map, total) {
    const el = document.getElementById('leasing-list');
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([n, v]) => `
        <div class="space-y-1 mb-2">
            <div class="flex justify-between text-[9px] font-bold">
                <span class="text-slate-500 uppercase">${n}</span>
                <span class="text-slate-700">${total > 0 ? ((v/total)*100).toFixed(1) : 0}%</span>
            </div>
            <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-blue-600 h-full" style="width: ${total > 0 ? (v/total)*100 : 0}%"></div>
            </div>
        </div>`).join('');
}

function renderTvcList(map) {
    const el = document.getElementById('tvc-detail-list');
    if (!el) return;
    el.innerHTML = ['TAFS', 'ACC'].map(name => `
        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 py-2">
            <span class="font-bold text-slate-500 uppercase">${name}</span>
            <span class="font-black text-blue-600 text-xs">${map[name] || 0} Unit</span>
        </div>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);