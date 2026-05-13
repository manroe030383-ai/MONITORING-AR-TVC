import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};

// Helper Formatting
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

// --- NAVIGASI ---
window.filterTab = function(btn, tabName) {
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('nav-active');
        b.classList.add('bg-white', 'text-slate-500');
    });
    btn.classList.add('nav-active');
    btn.classList.remove('bg-white', 'text-slate-500');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(`content-${tabName}`).classList.remove('hidden');

    if (tabName === 'ringkasan') window.dispatchEvent(new Event('resize'));
};

// 2. Ambil Data dari Supabase
async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;

        if (data) {
            updateDashboard(data); // Untuk Tab Dashboard
            renderDataARUnitUpdate(data); // Untuk Menu Update (Sidebar)
            document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

// 3. Distribusi Data ke Tab Masing-Masing
function updateDashboard(data) {
    let s = { os: 0, ov: 0, lan: 0, cash: 0, leas: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mapLeasing = {}, mapSales = {}, mapOverdue = {};

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();
        
        s.os += valOs;
        s.ov += Number(d.total_overdue || 0);
        s.lan += Number(d.lancar || 0);

        // Data Aging
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        if (["CASH", ""].includes(lName)) {
            s.cash += valOs;
        } else {
            s.leas += valOs;
            mapLeasing[lName] = (mapLeasing[lName] || 0) + valOs;
        }

        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        if (Number(d.total_overdue) > 0) {
            mapOverdue[d.customer_name] = Number(d.total_overdue);
        }
    });

    // Tampilkan di UI Ringkasan
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);

    // ISI TAB SESUAI JUDUL
    renderTabLeasing(mapLeasing);
    renderTabOverdue(data);
    renderTabDatabaseLengkap(data);
    
    // Charts
    renderCharts(s.cash, s.leas, aging);
}

// --- RENDER TAB LEASING ---
function renderTabLeasing(map) {
    const el = document.getElementById('tab-leasing-list');
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1]-a[1]).map(([name, val]) => `
        <div class="flex justify-between items-center p-4 border-b border-slate-50 bg-white">
            <span class="font-bold text-slate-700 uppercase text-[11px]">${name}</span>
            <span class="font-black text-blue-600 text-xs">${fmtIDR(val)}</span>
        </div>`).join('');
}

// --- RENDER TAB OVERDUE ---
function renderTabOverdue(data) {
    const el = document.getElementById('tab-overdue-list');
    if (!el) return;
    const ovData = data.filter(d => Number(d.total_overdue) > 0);
    el.innerHTML = ovData.map(d => `
        <div class="flex justify-between items-center p-4 border-b border-red-100 bg-red-50/30">
            <div>
                <p class="font-bold text-slate-800 uppercase text-[10px]">${d.customer_name}</p>
                <p class="text-[8px] text-slate-400">Leasing: ${d.leasing_name}</p>
            </div>
            <p class="font-black text-red-600 text-xs">${fmtIDR(d.total_overdue)}</p>
        </div>`).join('');
}

// --- RENDER TAB DATABASE LENGKAP (Tampilan Bersih) ---
function renderTabDatabaseLengkap(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;
    el.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50 border-b border-slate-50 text-[10px]">
            <td class="p-3 text-slate-400 font-bold">${i+1}</td>
            <td class="p-3 font-bold uppercase text-slate-700">${d.customer_name}</td>
            <td class="p-3 text-slate-500">${d.leasing_name || '-'}</td>
            <td class="p-3 text-right font-bold text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-3 text-slate-400 italic">${d.salesman_name || '-'}</td>
        </tr>`).join('');
}

// --- RENDER MENU DATA AR UNIT (UNTUK UPDATE) ---
function renderDataARUnitUpdate(data) {
    const el = document.getElementById('ar-unit-body'); // Pastikan ID ini ada di HTML menu sidebar
    if (!el) return;
    // Hanya TAFS & ACC sesuai image_3c900e.png
    const targetData = data.filter(d => ['TAFS', 'ACC'].includes((d.leasing_name || '').toUpperCase()));
    
    el.innerHTML = targetData.map((d, i) => `
        <tr class="border-b text-[11px]">
            <td class="p-4 text-slate-400">${i+1}</td>
            <td class="p-4 font-bold uppercase">${d.customer_name}</td>
            <td class="p-4">${d.leasing_name}</td>
            <td class="p-4 font-black text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-2">
                <textarea id="plan-${d.id}" class="w-full border rounded p-1 text-[10px]">${d.keterangan_cabang || ''}</textarea>
            </td>
            <td class="p-2">
                <textarea id="ket-leas-${d.id}" class="w-full border rounded p-1 text-[10px]">${d.keterangan_leasing || ''}</textarea>
            </td>
            <td class="p-4"><button onclick="saveUpdate('${d.id}')" class="bg-[#1B2559] text-white px-3 py-2 rounded text-[9px] font-bold">UPDATE</button></td>
        </tr>`).join('');
}

// --- FUNGSI UPDATE ---
window.saveUpdate = async function(id) {
    const plan = document.getElementById(`plan-${id}`).value;
    const leas = document.getElementById(`ket-leas-${id}`).value;
    const { error } = await supabase.from('ar_unit').update({ keterangan_cabang: plan, keterangan_leasing: leas }).eq('id', id);
    if (!error) { alert("Data Berhasil Disimpan"); fetchData(); }
};

// Charts (ApexCharts)
function renderCharts(cash, leas, aging) {
    if (!charts.bar) {
        charts.bar = new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Juta', data: Object.values(aging) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
            xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] }
        });
        charts.bar.render();
    } else {
        charts.bar.updateSeries([{ data: Object.values(aging) }]);
    }
}

document.addEventListener('DOMContentLoaded', fetchData);