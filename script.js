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
    const target = document.getElementById(`content-${tabName}`);
    if (target) target.classList.remove('hidden');

    if (tabName === 'ringkasan') {
        window.dispatchEvent(new Event('resize'));
    }
};

// 2. Fungsi Utama Ambil Data
async function fetchData() {
    const statusEl = document.getElementById('status-update');
    try {
        statusEl.innerText = "MENYINKRONKAN DATA...";
        
        const { data, error } = await supabase
            .from('ar_unit')
            .select('*')
            .order('os_balance', { ascending: false });
        
        if (error) throw error;

        if (data && data.length > 0) {
            updateDashboard(data); 
            statusEl.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
            statusEl.className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
        } else {
            statusEl.innerText = "DATA KOSONG DI DATABASE";
            statusEl.className = "text-[9px] font-bold text-orange-500 uppercase tracking-widest mb-1 italic";
        }
    } catch (e) {
        console.error("Detail Error:", e);
        statusEl.innerText = "ERROR: PERIKSA KONEKSI";
        statusEl.className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
    }
}

// 3. Logika Perhitungan & Distribusi Data
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, unitCash: 0, unitLeas: 0, cOv: 0, spkPenCount: 0 };
    let tvc = { totalUnit: 0, gi: 0, rd: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mapTvcDetail = { 'TAFS': 0, 'ACC': 0 };
    let mapLeasingSummary = {}, mapSales = {}, mapOverdue = {}, mapSpv = {};

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
            mapLeasingSummary[lName] = (mapLeasingSummary[lName] || 0) + valOs;
            
            if (lName === 'TAFS' || lName === 'ACC') {
                tvc.totalUnit++;
                if (d.gl_date) tvc.gi++; else tvc.rd++;
                mapTvcDetail[lName]++;
            }
        }

        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        mapSpv[d.spv_name || 'N/A'] = (mapSpv[d.spv_name] || 0) + valOs;
        if (valOv > 0) mapOverdue[d.customer_name || 'CUST'] = (mapOverdue[d.customer_name] || 0) + valOv;
    });

    // --- UPDATE UI RINGKASAN ---
    const updateEl = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
    updateEl('total-os', fmtIDR(s.os));
    updateEl('total-overdue', fmtIDR(s.ov));
    updateEl('total-penalty', fmtIDR(s.pen));
    updateEl('total-lancar', fmtIDR(s.lan));
    updateEl('val-total-cash', fmtIDR(s.cash));
    updateEl('unit-total-cash', `${s.unitCash} Unit`);
    updateEl('val-total-leas', fmtIDR(s.leas));
    updateEl('unit-total-leas', `${s.unitLeas} Unit`);
    updateEl('total-unit-tvc', `${tvc.totalUnit} Unit`);
    updateEl('unit-gi-tvc', `${tvc.gi} Unit`);
    updateEl('unit-delivery-tvc', `${tvc.rd} Unit`);
    updateEl('spk-penalty', `${s.spkPenCount} SPK`);
    updateEl('badge-overdue', `${s.cOv} SPK LEWAT TOP`);

    // --- RENDER ISI TAB (DIPERBAIKI) ---
    renderLeasingTabDetail(data);   // Rincian customer per leasing
    renderOverdueTabTable(data);    // List overdue
    renderFullDatabaseTable(data);  // Tabel lengkap

    // --- RENDER VISUAL GRAFIK & LIST ---
    renderCharts(s.cash, s.leas, aging);
    renderLeasingList(mapLeasingSummary, s.os);
    renderTopList('list-sales', mapSales, 'text-blue-600');
    renderTopList('list-overdue', mapOverdue, 'text-red-600');
    renderTvcList(mapTvcDetail);
    renderTopSpv(mapSpv, s.os);

    const barCash = document.getElementById('bar-cash');
    const barLeasing = document.getElementById('bar-leasing');
    if (barCash && barLeasing) {
        const cashPct = s.os > 0 ? (s.cash / s.os) * 100 : 0;
        barCash.style.width = `${cashPct}%`;
        barLeasing.style.width = `${100 - cashPct}%`;
    }
}

// --- FUNGSI RENDERER TAB RINCIAN LEASING ---
function renderLeasingTabDetail(data) {
    const el = document.getElementById('tab-leasing-list');
    if (!el) return;

    // Filter hanya data leasing (bukan cash)
    const leasingData = data.filter(d => !["CASH", "CASH TERIMA", ""].includes((d.leasing_name || '').toUpperCase().trim()));

    // Kelompokkan data berdasarkan Leasing
    const grouped = leasingData.reduce((acc, curr) => {
        const name = (curr.leasing_name || 'LAINNYA').toUpperCase().trim();
        if (!acc[name]) acc[name] = [];
        acc[name].push(curr);
        return acc;
    }, {});

    el.innerHTML = Object.entries(grouped).sort((a, b) => b[1].reduce((s, c) => s + Number(c.os_balance), 0) - a[1].reduce((s, c) => s + Number(c.os_balance), 0)).map(([leasName, customers]) => {
        const totalPerLeas = customers.reduce((sum, c) => sum + Number(c.os_balance || 0), 0);
        return `
            <div class="mb-6 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div class="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                    <h3 class="font-black text-blue-700 text-[11px] tracking-wider uppercase">${leasName}</h3>
                    <span class="text-[10px] font-bold text-slate-500">TOTAL: ${fmtIDR(totalPerLeas)}</span>
                </div>
                <div class="divide-y divide-slate-50">
                    ${customers.sort((a, b) => b.os_balance - a.os_balance).map(c => `
                        <div class="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <div>
                                <p class="text-[10px] font-bold text-slate-700 uppercase">${c.customer_name || 'N/A'}</p>
                                <p class="text-[8px] text-slate-400 uppercase font-medium">Sales: ${c.salesman_name || '-'}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-[10px] font-black text-slate-600">${fmtIDR(c.os_balance)}</p>
                                ${Number(c.total_overdue) > 0 ? `<p class="text-[7px] font-bold text-red-500 uppercase">Overdue: ${fmtIDR(c.total_overdue)}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// --- FUNGSI RENDERER TAB OVERDUE ---
function renderOverdueTabTable(data) {
    const el = document.getElementById('tab-overdue-list');
    if (!el) return;
    const ovData = data.filter(d => Number(d.total_overdue) > 0).sort((a,b) => b.total_overdue - a.total_overdue);
    el.innerHTML = ovData.length ? ovData.map(d => `
        <div class="flex justify-between items-center p-4 border-b border-red-50 bg-red-50/20 mb-1 rounded-lg">
            <div>
                <p class="font-bold text-slate-800 uppercase text-[10px]">${d.customer_name}</p>
                <p class="text-[8px] text-slate-400 uppercase">${d.leasing_name || 'CASH'} | ${d.salesman_name}</p>
            </div>
            <p class="font-black text-red-600 text-xs">${fmtIDR(d.total_overdue)}</p>
        </div>`).join('') : '<p class="p-6 text-slate-400 italic text-xs">Nihil Overdue.</p>';
}

// --- FUNGSI RENDERER TAB DATABASE ---
function renderFullDatabaseTable(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;
    el.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50 border-b border-slate-50 text-[10px]">
            <td class="p-3 text-slate-400 font-bold text-center">${i+1}</td>
            <td class="p-3 font-bold uppercase text-slate-700">${d.customer_name || '-'}</td>
            <td class="p-3 uppercase text-slate-500">${d.leasing_name || 'CASH'}</td>
            <td class="p-3 font-black text-blue-600 text-right">${fmtIDR(d.os_balance)}</td>
            <td class="p-3 font-black text-red-500 text-right">${fmtIDR(d.total_overdue)}</td>
            <td class="p-3 uppercase text-slate-400 italic">${d.salesman_name || 'N/A'}</td>
        </tr>`).join('');
}

// --- FUNGSI GRAFIK & LIST TAMBAHAN ---
function renderCharts(cash, leas, aging) {
    const agingEl = document.querySelector("#chart-aging");
    if (agingEl) {
        if (!charts.bar) {
            charts.bar = new ApexCharts(agingEl, {
                series: [{ name: 'Juta', data: Object.values(aging) }],
                chart: { type: 'bar', height: 250, toolbar: { show: false } },
                colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
                plotOptions: { bar: { borderRadius: 4, columnWidth: '50%', distributed: true } },
                xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'], labels: { style: { fontSize: '9px', fontWeight: 700 } } }
            });
            charts.bar.render();
        } else { charts.bar.updateSeries([{ data: Object.values(aging) }]); }
    }
}

function renderTopList(id, map, colorClass) {
    const el = document.getElementById(id); if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5).map((item, i) => `
        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 py-2">
            <span class="font-bold text-slate-600 uppercase truncate w-32">${i+1}. ${item[0]}</span>
            <span class="${colorClass} font-black text-xs">${fmtJuta(item[1])}</span>
        </div>`).join('');
}

function renderTopSpv(map, total) {
    const el = document.getElementById('list-spv'); if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5).map((item, i) => {
        const pct = total > 0 ? ((item[1] / total) * 100).toFixed(1) : 0;
        return `<div class="space-y-1 mb-2">
            <div class="flex justify-between text-[10px] font-bold">
                <span class="text-slate-600 uppercase truncate w-32">${i+1}. ${item[0]}</span>
                <span class="text-purple-600 font-black text-xs">${fmtJuta(item[1])}</span>
            </div>
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div class="bg-purple-500 h-full" style="width: ${pct}%"></div></div>
        </div>`;
    }).join('');
}

function renderLeasingList(map, total) {
    const el = document.getElementById('leasing-list'); if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([n, v]) => `
        <div class="space-y-1 mb-2">
            <div class="flex justify-between text-[9px] font-bold"><span class="text-slate-500">${n}</span><span>${total > 0 ? ((v/total)*100).toFixed(1) : 0}%</span></div>
            <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div class="bg-blue-600 h-full" style="width: ${total > 0 ? (v/total)*100 : 0}%"></div></div>
        </div>`).join('');
}

function renderTvcList(map) {
    const el = document.getElementById('tvc-detail-list'); if (!el) return;
    el.innerHTML = ['TAFS', 'ACC'].map(name => `
        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 py-2">
            <span class="font-bold text-slate-500 uppercase">${name}</span><span class="font-black text-blue-600 text-xs">${map[name] || 0} Unit</span>
        </div>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);