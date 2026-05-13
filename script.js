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
        } else {
            statusEl.innerText = "DATA KOSONG DI SUPABASE";
        }
    } catch (e) {
        console.error("Error:", e);
        document.getElementById('status-update').innerText = "ERROR KONEKSI";
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
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();
        
        s.os += valOs;
        s.ov += Number(d.total_overdue || 0);
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);
        
        if (Number(d.penalty_amount) > 0) s.spkPenCount++;
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
            
            if (lName === 'TAFS' || lName === 'ACC') {
                tvc.totalUnit++;
                if (d.gl_date) tvc.gi++; else tvc.rd++;
                mapTvcDetail[lName]++;
            }
        }

        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        mapSpv[d.spv_name || 'N/A'] = (mapSpv[d.spv_name] || 0) + valOs;
        if (Number(d.total_overdue) > 0) {
            mapOverdue[d.customer_name || 'CUST'] = (mapOverdue[d.customer_name] || 0) + Number(d.total_overdue);
        }
    });

    // Update UI Ringkasan
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

    // --- RENDER SEMUA TAB (TIDAK ADA YANG DIHAPUS) ---
    renderLeasingTabTable(mapLeasing);
    renderOverdueTabTable(data);
    renderFullDatabaseTable(data); // Fitur Update di bawah dashboard

    // Visuals
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

// --- TAB DATABASE LENGKAP (DATA AR UNIT DENGAN INPUT UPDATE) ---
function renderFullDatabaseTable(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;

    // Menampilkan data sesuai filter TAFS & ACC dengan fitur Update
    const tvcData = data.filter(d => 
        ['TAFS', 'ACC'].includes((d.leasing_name || '').toUpperCase().trim())
    );

    el.innerHTML = tvcData.map((d, i) => `
        <tr class="hover:bg-slate-50 border-b border-slate-50 text-[10px]">
            <td class="p-3 text-slate-400 font-bold">${i+1}</td>
            <td class="p-3 font-bold uppercase text-slate-700">${d.customer_name}</td>
            <td class="p-3 uppercase text-slate-500 font-medium">${d.leasing_name}</td>
            <td class="p-3 text-right font-black text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-2">
                <textarea id="plan-${d.id}" class="w-full border border-slate-200 rounded p-1 text-[9px] outline-none focus:ring-1 focus:ring-blue-400" rows="2" placeholder="Plan...">${d.keterangan_cabang || ''}</textarea>
            </td>
            <td class="p-2">
                <textarea id="ket-leas-${d.id}" class="w-full border border-slate-200 rounded p-1 text-[9px] outline-none focus:ring-1 focus:ring-red-400" rows="2" placeholder="Leasing...">${d.keterangan_leasing || ''}</textarea>
            </td>
            <td class="p-3 text-center">
                <button onclick="saveRemarks('${d.id}')" class="bg-[#1B2559] text-white px-3 py-2 rounded-md text-[8px] font-bold uppercase hover:bg-emerald-600 transition-all">Update</button>
            </td>
        </tr>
    `).join('');
}

// --- FUNGSI UPDATE KE DATABASE ---
window.saveRemarks = async function(id) {
    const btn = event.target;
    const planVal = document.getElementById(`plan-${id}`).value;
    const leasVal = document.getElementById(`ket-leas-${id}`).value;

    try {
        btn.innerText = "...";
        btn.disabled = true;
        const { error } = await supabase.from('ar_unit').update({ 
            keterangan_cabang: planVal, 
            keterangan_leasing: leasVal 
        }).eq('id', id);

        if (error) throw error;
        alert("Berhasil!");
        fetchData();
    } catch (err) {
        alert("Gagal simpan");
    } finally {
        btn.innerText = "UPDATE";
        btn.disabled = false;
    }
};

// --- FUNGSI TAB LEASING & OVERDUE (DIKEMBALIKAN) ---
function renderLeasingTabTable(mapLeasing) {
    const el = document.getElementById('tab-leasing-list');
    if (!el) return;
    el.innerHTML = Object.entries(mapLeasing).sort((a,b) => b[1]-a[1]).map(([name, val]) => `
        <div class="flex justify-between items-center p-4 border-b border-slate-50">
            <span class="font-bold text-slate-700 uppercase text-[10px]">${name}</span>
            <span class="font-black text-blue-600 text-xs">${fmtIDR(val)}</span>
        </div>`).join('');
}

function renderOverdueTabTable(data) {
    const el = document.getElementById('tab-overdue-list');
    if (!el) return;
    const overdueData = data.filter(d => Number(d.total_overdue) > 0).sort((a,b) => b.total_overdue - a.total_overdue);
    el.innerHTML = overdueData.map(d => `
        <div class="flex justify-between items-center p-4 border-b border-red-50 bg-red-50/20">
            <div>
                <p class="font-bold text-slate-800 uppercase text-[10px]">${d.customer_name}</p>
                <p class="text-[8px] text-slate-400">${d.leasing_name}</p>
            </div>
            <p class="font-black text-red-600 text-xs">${fmtIDR(d.total_overdue)}</p>
        </div>`).join('');
}

// Charts & Lists functions remain exactly as in your original script...
function renderCharts(cash, leas, aging) {
    if (!charts.bar) {
        charts.bar = new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Juta', data: Object.values(aging) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
            plotOptions: { bar: { borderRadius: 4, columnWidth: '50%', distributed: true } },
            xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] }
        });
        charts.bar.render();
    } else { charts.bar.updateSeries([{ data: Object.values(aging) }]); }

    if (!charts.donut) {
        charts.donut = new ApexCharts(document.querySelector("#chart-donut-leasing"), {
            series: [cash, leas],
            labels: ['Cash', 'Leasing'],
            chart: { type: 'donut', height: 230 },
            colors: ['#10B981', '#2563EB'],
            plotOptions: { pie: { donut: { size: '75%' } } }
        });
        charts.donut.render();
    } else { charts.donut.updateSeries([cash, leas]); }
}

function renderTopList(id, map, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5).map((item, i) => `
        <div class="flex justify-between items-center text-[10px] border-b border-slate-50 py-2">
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
        <div class="space-y-1 mb-2">
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
                <span class="text-slate-500">${n}</span>
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