import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

// --- FUNGSI TAB SWITCHING ---
window.filterTab = function(btn, tabName) {
    // 1. Ubah UI Tombol
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('nav-active');
        b.classList.add('bg-white', 'text-slate-500');
    });
    btn.classList.add('nav-active');
    btn.classList.remove('bg-white', 'text-slate-500');

    // 2. Tampilkan Konten yang Sesuai
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`content-${tabName}`).classList.remove('hidden');

    // 3. Fix Grafik (ApexCharts sering mengecil jika di tab tersembunyi)
    if (tabName === 'ringkasan') {
        window.dispatchEvent(new Event('resize'));
    }
};

async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;

        // Render semua bagian
        renderSummary(data);    // Dashboard Utama
        renderLeasingTab(data); // Tab Leasing
        renderOverdueTab(data); // Tab Overdue
        renderDatabaseTab(data);// Tab Database
        
        document.getElementById('status-update').innerText = "DATA TERUPDATE";
    } catch (e) {
        console.error(e);
    }
}

// --- RENDERER UNTUK TAB LEASING ---
function renderLeasingTab(data) {
    const container = document.getElementById('tab-leasing-list');
    const grouped = data.reduce((acc, curr) => {
        const name = curr.leasing_name || 'CASH';
        acc[name] = (acc[name] || 0) + Number(curr.os_balance || 0);
        return acc;
    }, {});

    container.innerHTML = Object.entries(grouped).map(([name, val]) => `
        <div class="flex justify-between p-4 items-center">
            <span class="font-bold text-slate-700">${name}</span>
            <span class="font-black text-blue-600">${fmtIDR(val)}</span>
        </div>
    `).join('');
}

// --- RENDERER UNTUK TAB OVERDUE ---
function renderOverdueTab(data) {
    const container = document.getElementById('tab-overdue-list');
    const filtered = data.filter(d => Number(d.total_overdue) > 0);

    container.innerHTML = filtered.map(d => `
        <div class="flex justify-between p-4 bg-red-50/30 mb-1 rounded-lg">
            <div>
                <p class="font-bold text-slate-800 uppercase">${d.customer_name}</p>
                <p class="text-[8px] text-slate-500">${d.leasing_name} | ${d.salesman_name}</p>
            </div>
            <div class="text-right">
                <p class="font-black text-red-600">${fmtIDR(d.total_overdue)}</p>
                <p class="text-[8px] font-bold text-red-400 uppercase italic">Lewat TOP</p>
            </div>
        </div>
    `).join('');
}

// --- RENDERER UNTUK TAB DATABASE ---
function renderDatabaseTab(data) {
    const tbody = document.getElementById('tab-database-body');
    tbody.innerHTML = data.map(d => `
        <tr class="hover:bg-slate-50">
            <td class="p-4 font-bold uppercase">${d.customer_name}</td>
            <td class="p-4">${d.leasing_name || 'CASH'}</td>
            <td class="p-4 font-bold text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-4 font-bold text-red-600">${fmtIDR(d.total_overdue)}</td>
            <td class="p-4 uppercase">${d.salesman_name}</td>
        </tr>
    `).join('');
}

// Jalankan saat startup
document.addEventListener('DOMContentLoaded', loadData);