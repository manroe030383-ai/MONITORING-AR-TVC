import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// KONFIGURASI SUPABASE
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
        if (data) {
            updateDashboard(data);
            const statusEl = document.getElementById('status-update');
            if (statusEl) {
                statusEl.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
                statusEl.className = "text-[10px] font-bold text-emerald-600 italic mb-2 block";
            }
        }
    } catch (e) {
        console.error(e);
        const statusEl = document.getElementById('status-update');
        if (statusEl) {
            statusEl.innerText = "KONEKSI DATABASE GAGAL!";
            statusEl.className = "text-[10px] font-bold text-red-600 italic mb-2 block";
        }
    }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {}, mOverdueList = [];

    data.forEach(d => {
        const os = Number(d.os_balance || 0);
        const ov = Number(d.total_overdue || 0);
        const l = (d.leasing_name || 'CASH').toUpperCase().trim();
        
        s.os += os; 
        s.ov += ov; 
        s.pen += Number(d.penalty_amount || 0); 
        s.lan += Number(d.lancar || 0);

        if (ov > 0) { 
            s.countOv++; 
            mOverdueList.push(d); 
        }
        if (Number(d.penalty_amount) > 0) s.cPen++;

        // Aging
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        // Leasing & Cash
        if (["CASH", "CASH TERIMA", ""].includes(l)) { 
            s.cash += os; s.cCash++; 
        } else { 
            s.leas += os; s.cLeas++; 
            mLeas[l] = (mLeas[l] || 0) + os; 
            if (l.includes('TAFS') || l.includes('ACC')) {
                tvc.total++;
                if (d.status_tagih === 'SUDAH GI') tvc.gi++;
                else tvc.deliv++;
            }
        }

        // Logic Nama dari Supabase
        const nameSales = (d.salesman_name || "OFFICE").toUpperCase();
        const nameSpv = (d.supervisor_name || "OFFICE").toUpperCase();

        mSales[nameSales] = (mSales[nameSales] || 0) + os;
        mSpv[nameSpv] = (mSpv[nameSpv] || 0) + os;
    });

    // Header Metrics
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    if(document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    if(document.getElementById('badge-overdue')) document.getElementById('badge-overdue').innerText = `${s.countOv} SPK LEWAT TOP`;

    // Render Components
    renderAgingChart(aging);
    renderDonutLeasing(mLeas);
    renderLeasingTab(mLeas, s.os);
    renderOverdueTab(mOverdueList);
    renderDatabaseTable(data);
    
    // Summary Lists
    renderTopList(mSales, 'list-sales', 'text-blue-600');
    renderTopList(mSpv, 'list-spv', 'text-purple-600');
}

// 1. TAMPILAN DATABASE LENGKAP (Sesuai Gambar 4)
function renderDatabaseTable(data) {
    const container = document.getElementById('tab-database-body');
    if (!container) return;

    container.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="p-4 text-slate-400 font-bold text-[10px] text-center">${i + 1}</td>
            <td class="p-4">
                <p class="font-bold uppercase text-blue-900 text-[11px] mb-0.5">${d.customer_name || '-'}</p>
                <p class="text-[9px] text-slate-400 font-medium uppercase">SALES: ${d.salesman_name || 'OFFICE'}</p>
            </td>
            <td class="p-4 uppercase font-bold text-slate-600 text-[10px]">${d.leasing_name || 'CASH'}</td>
            <td class="p-4 text-right font-black text-blue-600 text-[11px]">${fmtIDR(d.os_balance)}</td>
            <td class="p-4">
                <input type="text" class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500" 
                placeholder="Tgl Rencana Bayar..." value="${d.plan_bayar || ''}">
            </td>
            <td class="p-4">
                <input type="text" class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500" 
                placeholder="Keterangan..." value="${d.keterangan_leasing || ''}">
            </td>
            <td class="p-4 text-center">
                <button class="text-purple-400 hover:text-purple-600 transition-colors">
                    <i class="fas fa-save shadow-sm"></i> 💾
                </button>
            </td>
        </tr>`).join('');
}

// 2. TAB LEASING
function renderLeasingTab(map, total) {
    const container = document.getElementById('detail-leasing-tab');
    if (!container) return;

    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            ${sorted.map(([name, val]) => `
                <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${name}</p>
                        <p class="text-lg font-black text-blue-900">${fmtIDR(val)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded">${((val/(total||1))*100).toFixed(1)}%</p>
                    </div>
                </div>
            `).join('')}
        </div>`;
}

// 3. TAB OVERDUE
function renderOverdueTab(data) {
    const container = document.getElementById('detail-overdue-tab');
    if (!container) return;

    const sorted = [...data].sort((a, b) => Number(b.total_overdue) - Number(a.total_overdue));
    container.innerHTML = sorted.length ? sorted.map(d => `
        <div class="flex justify-between items-center p-4 border-b border-red-50 bg-red-50/20 mb-2 rounded-lg mx-4">
            <div>
                <p class="font-bold text-[11px] uppercase text-red-900">${d.customer_name}</p>
                <p class="text-[9px] text-slate-500 font-medium">LEASING: ${d.leasing_name || 'CASH'} | SPV: ${d.supervisor_name || 'OFFICE'}</p>
            </div>
            <div class="text-right">
                <p class="font-black text-red-600 text-sm">${fmtIDR(d.total_overdue)}</p>
                <p class="text-[9px] font-bold text-slate-400">O/S BALANCE: ${fmtIDR(d.os_balance)}</p>
            </div>
        </div>`).join('') : '<p class="text-center p-10 text-slate-400 font-bold uppercase text-xs">Tidak ada data overdue</p>';
}

// Charts & Helpers
function renderAgingChart(agingData) {
    const options = {
        series: [{ name: 'Juta', data: Object.values(agingData).map(v => Math.round(v)) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: (v) => v + " Jt", style: { fontSize: '9px', fontWeight: 800 }, offsetY: -20 },
        xaxis: { categories: Object.keys(agingData), labels: { style: { fontSize: '9px', fontWeight: 700 } } },
        yaxis: { show: false }, grid: { show: false }
    };
    if (charts.bar) charts.bar.updateOptions(options);
    else { charts.bar = new ApexCharts(document.querySelector("#chart-aging"), options); charts.bar.render(); }
}

function renderDonutLeasing(mLeas) {
    const options = {
        series: Object.values(mLeas),
        labels: Object.keys(mLeas),
        chart: { type: 'donut', height: 200 },
        legend: { position: 'bottom', fontSize: '10px', fontWeight: 700 },
        colors: ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E']
    };
    if (charts.donut) charts.donut.updateOptions(options);
    else { charts.donut = new ApexCharts(document.querySelector("#chart-donut-leasing"), options); charts.donut.render(); }
}

function renderTopList(map, id, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map((x,i) => `
        <div class="flex justify-between items-center py-3 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${x[0]}</span>
            <span class="text-[10px] ${colorClass}">${fmtJuta(x[1])}</span>
        </div>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);