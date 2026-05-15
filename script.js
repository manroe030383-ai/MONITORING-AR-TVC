import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Database
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};

// Helper Format IDR
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

// 2. Fungsi Ambil Data
async function fetchData() {
    const statusEl = document.getElementById('status-update');
    try {
        statusEl.innerText = "MENYINKRONKAN DATA...";
        const { data, error } = await supabase.from('ar_unit').select('*').order('os_balance', { ascending: false });
        
        if (error) throw error;
        if (data) {
            updateDashboard(data); 
            statusEl.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
            statusEl.className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
        }
    } catch (e) {
        statusEl.innerText = "ERROR: PERIKSA KONEKSI";
        statusEl.className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
    }
}

// 3. Logika Utama Dashboard
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, countOv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mapLeas = {}, mapSales = {}, mapSpv = {};

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const valOv = Number(d.total_overdue || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();
        
        s.os += valOs;
        s.ov += valOv;
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);
        if (valOv > 0) s.countOv++;

        // Aging Data
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        if (["CASH", "CASH TERIMA", ""].includes(lName)) {
            s.cash += valOs;
        } else {
            s.leas += valOs;
            mapLeas[lName] = (mapLeas[lName] || 0) + valOs;
        }

        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        mapSpv[d.spv_name || 'N/A'] = (mapSpv[d.spv_name] || 0) + valOs;
    });

    // --- RENDER KE HTML ---
    const set = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
    
    set('total-os', fmtIDR(s.os));
    set('total-overdue', fmtIDR(s.ov));
    set('total-lancar', fmtIDR(s.lan));
    set('total-penalty', fmtIDR(s.pen));
    set('badge-overdue', `${s.countOv} SPK LEWAT TOP`);

    // Progress Bar (Hijau-Biru)
    if(document.getElementById('bar-cash')) {
        const pCash = s.os > 0 ? (s.cash / s.os) * 100 : 0;
        document.getElementById('bar-cash').style.width = `${pCash}%`;
        document.getElementById('bar-leasing').style.width = `${100 - pCash}%`;
    }

    // Panggil Semua Fungsi Render
    renderAgingChart(aging);
    renderBreakdownLeasing(mapLeas, s.os);
    renderTopRank('list-sales', mapSales, 'text-blue-600');
    renderTopRank('list-spv', mapSpv, 'text-purple-600');
    
    // Render Tab Lainnya
    renderTabLeasingRinci(data); 
    renderTabOverdue(data);
    renderTabDatabase(data);
}

// --- FUNGSI KOMPONEN VISUAL ---

function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging");
    if (!el) return;
    const options = {
        series: [{ name: 'Juta', data: Object.values(agingData) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } },
        xaxis: { categories: Object.keys(agingData), labels: { style: { fontSize: '9px', fontWeight: 700 } } }
    };
    if (charts.bar) { charts.bar.updateOptions(options); } 
    else { charts.bar = new ApexCharts(el, options); charts.bar.render(); }
}

function renderBreakdownLeasing(map, total) {
    const el = document.getElementById('leasing-list');
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).map(([n, v]) => `
        <div class="mb-3">
            <div class="flex justify-between text-[9px] font-bold mb-1">
                <span class="text-slate-500 uppercase">${n}</span>
                <span>${((v/total)*100).toFixed(1)}%</span>
            </div>
            <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-blue-600 h-full" style="width: ${(v/total)*100}%"></div>
            </div>
        </div>
    `).join('');
}

function renderTopRank(id, map, color) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5).map((item, i) => `
        <div class="flex justify-between items-center text-[10px] py-2 border-b border-slate-50">
            <span class="font-bold text-slate-600 uppercase truncate w-40">${i+1}. ${item[0]}</span>
            <span class="${color} font-black">${fmtJuta(item[1])}</span>
        </div>
    `).join('');
}

// --- FUNGSI TAB DETAIL ---

function renderTabLeasingRinci(data) {
    const el = document.getElementById('tab-leasing-list');
    if (!el) return;
    const leasOnly = data.filter(d => !["CASH", "CASH TERIMA", ""].includes((d.leasing_name || '').toUpperCase().trim()));
    const grouped = leasOnly.reduce((acc, curr) => {
        const name = (curr.leasing_name || 'LAINNYA').toUpperCase().trim();
        if (!acc[name]) acc[name] = [];
        acc[name].push(curr);
        return acc;
    }, {});

    el.innerHTML = Object.entries(grouped).map(([name, custs]) => `
        <div class="bg-white rounded-xl border border-slate-100 mb-4 shadow-sm overflow-hidden">
            <div class="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                <span class="font-black text-blue-700 text-[10px] uppercase">${name}</span>
                <span class="text-[9px] font-bold text-slate-500 italic">Total: ${fmtIDR(custs.reduce((s,c) => s + Number(c.os_balance), 0))}</span>
            </div>
            <div class="divide-y divide-slate-50">
                ${custs.map(c => `
                    <div class="px-4 py-2 flex justify-between items-center hover:bg-slate-50 transition-all">
                        <div>
                            <p class="text-[9px] font-bold text-slate-700 uppercase">${c.customer_name}</p>
                            <p class="text-[7px] text-slate-400 uppercase">${c.salesman_name}</p>
                        </div>
                        <span class="text-[9px] font-black text-slate-600">${fmtIDR(c.os_balance)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderTabOverdue(data) {
    const el = document.getElementById('tab-overdue-list');
    if(!el) return;
    const ovData = data.filter(d => Number(d.total_overdue) > 0);
    el.innerHTML = ovData.map(d => `
        <div class="flex justify-between p-3 bg-red-50/20 border-b border-red-100 rounded-lg mb-1">
            <div class="text-[9px] font-bold uppercase text-slate-700">${d.customer_name}</div>
            <div class="text-[9px] font-black text-red-600">${fmtIDR(d.total_overdue)}</div>
        </div>
    `).join('');
}

function renderTabDatabase(data) {
    const el = document.getElementById('tab-database-body');
    if(!el) return;
    el.innerHTML = data.map((d, i) => `
        <tr class="text-[9px] border-b border-slate-50 hover:bg-slate-50">
            <td class="p-2 text-center text-slate-400">${i+1}</td>
            <td class="p-2 font-bold uppercase text-slate-700">${d.customer_name}</td>
            <td class="p-2 uppercase text-slate-500">${d.leasing_name || 'CASH'}</td>
            <td class="p-2 text-right font-bold text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-2 text-right font-bold text-red-500">${fmtIDR(d.total_overdue)}</td>
            <td class="p-2 uppercase text-slate-400 font-medium">${d.salesman_name || '-'}</td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);