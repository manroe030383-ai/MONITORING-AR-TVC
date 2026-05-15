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
            statusEl.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
            statusEl.classList.replace('text-red-600', 'text-emerald-600');
        }
    } catch (e) {
        console.error(e);
        const statusEl = document.getElementById('status-update');
        statusEl.innerText = "KONEKSI GAGAL!";
        statusEl.classList.replace('text-emerald-600', 'text-red-600');
    }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {}, mOverdueTop = [];

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
            mOverdueTop.push(d); 
        }
        if (Number(d.penalty_amount) > 0) s.cPen++;

        // Aging Analysis
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        // Cash vs Leasing Logic
        if (["CASH", "CASH TERIMA", "", "TUNAI"].includes(l)) { 
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

        // Dinamis Nama: Salesman & Supervisor
        const rawSales = (d.salesman_name || "").trim();
        const rawSpv = (d.supervisor_name || "").trim();
        const finalSales = rawSales !== "" ? rawSales : (rawSpv !== "" ? rawSpv : "OFFICE");
        const finalSpv = rawSpv !== "" ? rawSpv : "OFFICE";

        mSales[finalSales] = (mSales[finalSales] || 0) + os;
        mSpv[finalSpv] = (mSpv[finalSpv] || 0) + os;
    });

    // Render Header & Cards
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('badge-overdue').innerText = `${s.countOv} SPK LEWAT TOP`;
    document.getElementById('spk-penalty').innerText = `${s.cPen} SPK`;
    
    // Progress Bars
    const pctCash = (s.cash / (s.os || 1)) * 100;
    const pctLeas = (s.leas / (s.os || 1)) * 100;
    document.getElementById('bar-cash').style.width = `${pctCash}%`;
    document.getElementById('bar-leasing').style.width = `${pctLeas}%`;
    document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    document.getElementById('unit-total-cash').innerText = `${s.cCash} Unit`;
    document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    document.getElementById('unit-total-leas').innerText = `${s.cLeas} Unit`;

    // TVC Section
    document.getElementById('total-unit-tvc').innerText = `${tvc.total} Unit`;
    document.getElementById('unit-gi-tvc').innerText = `${tvc.gi} Unit`;
    document.getElementById('unit-delivery-tvc').innerText = `${tvc.deliv} Unit`;

    // Render All Views
    renderAgingChart(aging);
    renderDonutLeasing(mLeas);
    renderLeasingList(mLeas, s.os);
    renderTopList(mSales, 'list-sales', 'text-blue-600');
    renderTopList(mSpv, 'list-spv', 'text-purple-600');
    renderOverdueTop(mOverdueTop);
    renderTabDatabase(data);
}

function renderAgingChart(agingData) {
    const options = {
        series: [{ name: 'Juta', data: Object.values(agingData).map(v => Math.round(v)) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: (v) => v + " Jt", style: { fontSize: '9px', fontWeight: 800 }, offsetY: -20 },
        xaxis: { categories: Object.keys(agingData), labels: { style: { fontSize: '9px', fontWeight: 700 } } },
        yaxis: { show: false },
        grid: { show: false }
    };
    if (charts.bar) charts.bar.updateOptions(options);
    else { charts.bar = new ApexCharts(document.querySelector("#chart-aging"), options); charts.bar.render(); }
}

function renderDonutLeasing(mLeas) {
    const options = {
        series: Object.values(mLeas),
        labels: Object.keys(mLeas),
        chart: { type: 'donut', height: 180 },
        legend: { show: false },
        dataLabels: { enabled: false },
        colors: ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E']
    };
    if (charts.donut) charts.donut.updateOptions(options);
    else { charts.donut = new ApexCharts(document.querySelector("#chart-donut-leasing"), options); charts.donut.render(); }
}

function renderLeasingList(map, total) {
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const html = sorted.map(([n, v]) => `
        <div class="mb-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <div class="flex justify-between text-[10px] font-bold mb-2 uppercase text-slate-700">
                <span>${n}</span>
                <span class="text-blue-600">${fmtIDR(v)} (${((v / (total || 1)) * 100).toFixed(1)}%)</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div class="bg-blue-500 h-full" style="width: ${(v / (total || 1)) * 100}%"></div>
            </div>
        </div>`).join('');
    
    // Update ke container leasing-list (Ringkasan) dan detail-leasing-tab (Tab Leasing)
    if(document.getElementById('leasing-list')) document.getElementById('leasing-list').innerHTML = html;
    if(document.getElementById('detail-leasing-tab')) document.getElementById('detail-leasing-tab').innerHTML = html;
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

function renderOverdueTop(data) {
    const sorted = [...data].sort((a, b) => Number(b.total_overdue) - Number(a.total_overdue));
    
    // Render Ringkasan
    if(document.getElementById('list-overdue')) {
        document.getElementById('list-overdue').innerHTML = sorted.slice(0,5).map((d,i) => `
            <div class="flex justify-between py-2 border-b border-slate-50 uppercase font-bold text-red-500">
                <span class="text-[10px] truncate w-32">${i+1}. ${d.customer_name}</span>
                <span class="text-[10px]">${fmtJuta(d.total_overdue)}</span>
            </div>`).join('');
    }

    // Render Tab Overdue
    if(document.getElementById('detail-overdue-tab')) {
        document.getElementById('detail-overdue-tab').innerHTML = sorted.map(d => `
            <div class="flex justify-between items-center p-4 border-b border-red-50 bg-red-50/10 mb-2 rounded-lg">
                <div>
                    <p class="font-bold text-[11px] uppercase text-slate-800">${d.customer_name}</p>
                    <p class="text-[9px] text-slate-500">${d.leasing_name || 'CASH'}</p>
                </div>
                <div class="text-right">
                    <p class="font-black text-red-600">${fmtIDR(d.total_overdue)}</p>
                    <p class="text-[8px] text-slate-400">SALES: ${d.salesman_name || 'OFFICE'}</p>
                </div>
            </div>`).join('');
    }
}

function renderTabDatabase(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;
    el.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-4 text-slate-400 font-bold">${i+1}</td>
            <td class="p-4">
                <p class="font-bold uppercase text-slate-700">${d.customer_name}</p>
                <p class="text-[8px] text-slate-400">SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
            </td>
            <td class="p-4 uppercase font-bold text-slate-600 text-[10px]">${d.leasing_name || 'CASH'}</td>
            <td class="p-4 text-right font-black text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-4 text-right font-bold text-red-500">${fmtIDR(d.total_overdue)}</td>
            <td class="p-4 text-center"><button class="bg-slate-100 hover:bg-emerald-500 hover:text-white p-2 rounded-lg transition-all shadow-sm">💾</button></td>
        </tr>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);