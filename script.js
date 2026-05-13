import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Kredensial Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};

// Helper Format Angka
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

// --- FUNGSI AMBIL DATA ---
async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;

        if (data) {
            updateDashboard(data);
            document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
        }
    } catch (e) {
        console.error("Error Fetching:", e);
    }
}

// --- DISTRIBUSI DATA KE TAB ---
function updateDashboard(data) {
    // 1. Data Ringkasan (Gunakan kodingan ringkasan Anda yang sudah ada di sini)
    // ...

    // 2. Render Tab Leasing (Sesuai Judul)
    renderTabLeasing(data);

    // 3. Render Tab Overdue (Hanya yang memiliki Overdue > 0)
    renderTabOverdue(data);

    // 4. Render Tab Database Lengkap (Semua Data - Sesuai image_3b9f33.png)
    renderTabDatabaseLengkap(data);
}

// --- RENDER TAB LEASING ---
function renderTabLeasing(data) {
    const el = document.getElementById('tab-leasing-list'); // Pastikan ID ini ada di HTML Anda
    if (!el) return;
    
    // Filter hanya data yang bukan CASH
    const leasingData = data.filter(d => d.leasing_name && !['CASH', ''].includes(d.leasing_name.toUpperCase().trim()));
    
    el.innerHTML = leasingData.map((d, i) => `
        <div class="flex justify-between items-center p-4 border-b border-slate-50">
            <div class="text-[10px]">
                <p class="font-bold text-slate-700 uppercase">${d.customer_name}</p>
                <p class="text-slate-400">${d.leasing_name}</p>
            </div>
            <div class="text-right">
                <p class="font-black text-blue-600 text-xs">${fmtIDR(d.os_balance)}</p>
                <p class="text-[8px] italic text-slate-400">${d.salesman_name || '-'}</p>
            </div>
        </div>
    `).join('');
}

// --- RENDER TAB OVERDUE ---
function renderTabOverdue(data) {
    const el = document.getElementById('tab-overdue-list');
    if (!el) return;
    
    // Filter data yang memiliki total_overdue lebih dari 0
    const overdueData = data.filter(d => Number(d.total_overdue) > 0).sort((a, b) => b.total_overdue - a.total_overdue);
    
    el.innerHTML = overdueData.map((d) => `
        <div class="flex justify-between items-center p-4 border-b border-red-50 bg-red-50/20">
            <div class="text-[10px]">
                <p class="font-bold text-slate-800 uppercase">${d.customer_name}</p>
                <p class="text-[8px] text-slate-400">${d.leasing_name || 'CASH'}</p>
            </div>
            <div class="text-right">
                <p class="font-black text-red-600 text-xs">${fmtIDR(d.total_overdue)}</p>
                <p class="text-[8px] text-slate-500">Sales: ${d.salesman_name || '-'}</p>
            </div>
        </div>
    `).join('');
}

// --- RENDER TAB DATABASE LENGKAP (STRUKTUR TABEL SESUAI GAMBAR) ---
function renderTabDatabaseLengkap(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;

    el.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50 border-b border-slate-50 text-[10px]">
            <td class="p-3 text-slate-400 font-bold">${i + 1}</td>
            <td class="p-3 font-bold uppercase text-slate-700">${d.customer_name}</td>
            <td class="p-3 text-slate-500 uppercase">${d.leasing_name || 'CASH'}</td>
            <td class="p-3 text-right font-bold text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-3 text-right font-bold text-red-600">${fmtIDR(d.total_overdue)}</td>
            <td class="p-3 text-slate-400 italic uppercase">${d.salesman_name || '-'}</td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);