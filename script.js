import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Kredensial Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};

// Helper Format Angka
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

// --- FUNGSI NAVIGASI SIDEBAR & TAB ---
window.showMenu = function(menuName) {
    // Navigasi Sidebar (Dashboard Unit vs Data AR Unit)
    document.querySelectorAll('.menu-content').forEach(m => m.classList.add('hidden'));
    document.getElementById(`menu-${menuName}`).classList.remove('hidden');
    
    // Update UI Sidebar
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('bg-red-600', 'text-white'));
    event.currentTarget.classList.add('bg-red-600', 'text-white');
};

window.filterTab = function(btn, tabName) {
    // Navigasi Tab di dalam Dashboard Unit
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

// 2. Fungsi Utama Ambil Data
async function fetchData() {
    try {
        const statusEl = document.getElementById('status-update');
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;

        if (data && data.length > 0) {
            updateDashboard(data);
            renderDataARUnit(data); // Render khusus untuk menu Data AR Unit
            statusEl.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

// 3. Logika Dashboard Unit (Tab Ringkasan, Leasing, Overdue, Database Lengkap)
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, unitCash: 0, unitLeas: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mapLeasing = {}, mapSales = {}, mapOverdue = {};

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();
        
        s.os += valOs;
        s.ov += Number(d.total_overdue || 0);
        s.lan += Number(d.lancar || 0);

        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        if (["CASH", ""].includes(lName)) {
            s.cash += valOs; s.unitCash++;
        } else {
            s.leas += valOs; s.unitLeas++;
            mapLeasing[lName] = (mapLeasing[lName] || 0) + valOs;
        }

        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        if (Number(d.total_overdue) > 0) {
            mapOverdue[d.customer_name || 'CUST'] = (mapOverdue[d.customer_name] || 0) + Number(d.total_overdue);
        }
    });

    // Update UI Ringkasan & Tab Dashboard
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    
    renderLeasingTab(mapLeasing);
    renderOverdueTab(data);
    renderDatabaseLengkapTab(data); // Tab "Database Lengkap" murni (tanpa input)
    renderCharts(s.cash, s.leas, aging);
}

// --- FUNGSI RENDER MENU DATA AR UNIT (DENGAN FITUR UPDATE) ---
function renderDataARUnit(data) {
    const el = document.getElementById('ar-unit-body');
    if (!el) return;

    // Filter TAFS & ACC sesuai permintaan Anda
    const filtered = data.filter(d => ['TAFS', 'ACC'].includes((d.leasing_name || '').toUpperCase().trim()));

    el.innerHTML = filtered.map((d, i) => `
        <tr class="hover:bg-slate-50 border-b border-slate-50 text-[11px]">
            <td class="p-4 text-slate-400 font-bold">${i+1}</td>
            <td class="p-4 font-bold text-slate-700">${d.customer_name}</td>
            <td class="p-4 font-medium text-slate-500">${d.leasing_name}</td>
            <td class="p-4 font-black text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-2">
                <textarea id="plan-${d.id}" class="w-full border border-slate-200 rounded p-1 text-[10px]" rows="2">${d.keterangan_cabang || ''}</textarea>
            </td>
            <td class="p-2">
                <textarea id="ket-leas-${d.id}" class="w-full border border-slate-200 rounded p-1 text-[10px]" rows="2">${d.keterangan_leasing || ''}</textarea>
            </td>
            <td class="p-4 text-center">
                <button onclick="saveDataAR('${d.id}')" class="bg-[#1B2559] text-white px-4 py-2 rounded font-bold uppercase text-[9px]">Update</button>
            </td>
        </tr>
    `).join('');
}

// --- FUNGSI UPDATE DATA ---
window.saveDataAR = async function(id) {
    const btn = event.target;
    const pVal = document.getElementById(`plan-${id}`).value;
    const lVal = document.getElementById(`ket-leas-${id}`).value;

    try {
        btn.innerText = "...";
        const { error } = await supabase.from('ar_unit').update({ 
            keterangan_cabang: pVal, 
            keterangan_leasing: lVal 
        }).eq('id', id);

        if (error) throw error;
        alert("Data AR Unit Berhasil Diperbarui!");
        fetchData();
    } catch (err) {
        alert("Gagal Update");
    } finally {
        btn.innerText = "UPDATE";
    }
};

// --- FUNGSI KEMBALIKAN TAB DASHBOARD (LEASING, OVERDUE, DB LENGKAP) ---
function renderLeasingTab(map) {
    const el = document.getElementById('tab-leasing-list');
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b) => b[1]-a[1]).map(([name, val]) => `
        <div class="flex justify-between p-4 border-b">
            <span class="font-bold text-[10px]">${name}</span>
            <span class="font-black text-blue-600 text-xs">${fmtIDR(val)}</span>
        </div>`).join('');
}

function renderOverdueTab(data) {
    const el = document.getElementById('tab-overdue-list');
    if (!el) return;
    el.innerHTML = data.filter(d => Number(d.total_overdue) > 0).map(d => `
        <div class="flex justify-between p-4 border-b bg-red-50/20">
            <div>
                <p class="font-bold text-[10px] uppercase">${d.customer_name}</p>
                <p class="text-[8px] text-slate-400">${d.leasing_name}</p>
            </div>
            <p class="font-black text-red-600 text-xs">${fmtIDR(d.total_overdue)}</p>
        </div>`).join('');
}

function renderDatabaseLengkapTab(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;
    el.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50 border-b text-[10px]">
            <td class="p-3 text-slate-400">${i+1}</td>
            <td class="p-3 font-bold uppercase">${d.customer_name}</td>
            <td class="p-3">${d.leasing_name || 'CASH'}</td>
            <td class="p-3 font-black text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-3 text-slate-400 italic">${d.salesman_name}</td>
        </tr>`).join('');
}

// Fungsi Render Charts Tetap Sama...
function renderCharts(cash, leas, aging) {
    if (!charts.bar) {
        charts.bar = new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Juta', data: Object.values(aging) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
            xaxis: { categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'] }
        });
        charts.bar.render();
    } else { charts.bar.updateSeries([{ data: Object.values(aging) }]); }

    if (!charts.donut) {
        charts.donut = new ApexCharts(document.querySelector("#chart-donut-leasing"), {
            series: [cash, leas],
            labels: ['Cash', 'Leasing'],
            chart: { type: 'donut', height: 230 },
            colors: ['#10B981', '#2563EB']
        });
        charts.donut.render();
    } else { charts.donut.updateSeries([cash, leas]); }
}

document.addEventListener('DOMContentLoaded', fetchData);