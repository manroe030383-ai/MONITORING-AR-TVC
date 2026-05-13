import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};

// Helper Format Angka
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

// 2. Fungsi Ambil Data & Distribusi ke Tab
async function fetchData() {
    try {
        const statusEl = document.getElementById('status-update');
        statusEl.innerText = "MENYINKRONKAN DATA...";

        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;

        if (data && data.length > 0) {
            // Isi semua konten tab sekaligus agar perpindahan tab instan
            updateRingkasan(data);
            updateTabLeasing(data);
            updateTabOverdue(data);
            updateTabDatabase(data);

            statusEl.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
        }
    } catch (e) {
        console.error("Error:", e);
        document.getElementById('status-update').innerText = "KONEKSI GAGAL: CEK KONSOL";
    }
}

// ==========================================
// LOGIKA NAVIGASI TAB (UI)
// ==========================================
window.switchTab = function(tabName, event) {
    // Sembunyikan semua konten
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    
    // Tampilkan konten yang dipilih
    document.getElementById(`content-${tabName}`).classList.remove('hidden');

    // Update style tombol
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-indigo-900', 'text-white', 'shadow-md');
        btn.classList.add('bg-white', 'text-slate-600');
    });

    // Aktifkan tombol yang diklik
    event.currentTarget.classList.add('bg-indigo-900', 'text-white', 'shadow-md');
    event.currentTarget.classList.remove('bg-white', 'text-slate-600');

    // Paksa grafik render ulang jika masuk tab ringkasan
    if (tabName === 'ringkasan') window.dispatchEvent(new Event('resize'));
};

// ==========================================
// PENGISIAN DATA TIAP TAB
// ==========================================

// TAB 1: RINGKASAN (Grafik & Stat Utama)
function updateRingkasan(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    
    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        s.os += valOs;
        s.ov += Number(d.total_overdue || 0);
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);

        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        if (["CASH", "CASH TERIMA", ""].includes((d.leasing_name || '').toUpperCase())) {
            s.cash += valOs;
        } else {
            s.leas += valOs;
        }
    });

    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    
    renderCharts(s.cash, s.leas, aging);
}

// TAB 2: LEASING (Detail Kontribusi Leasing)
function updateTabLeasing(data) {
    const listEl = document.getElementById('leasing-detail-list');
    if (!listEl) return;

    let mapLeas = {};
    data.forEach(d => {
        const name = (d.leasing_name || 'CASH').toUpperCase();
        if (name !== 'CASH') {
            mapLeas[name] = (mapLeas[name] || 0) + Number(d.os_balance || 0);
        }
    });

    listEl.innerHTML = Object.entries(mapLeas).sort((a,b) => b[1]-a[1]).map(([name, val]) => `
        <div class="flex justify-between p-3 border-b">
            <span class="font-bold text-slate-700">${name}</span>
            <span class="text-blue-600 font-black">${fmtIDR(val)}</span>
        </div>
    `).join('');
}

// TAB 3: OVERDUE (Daftar Konsumen Macet)
function updateTabOverdue(data) {
    const listEl = document.getElementById('overdue-detail-list');
    if (!listEl) return;

    const overdueData = data.filter(d => Number(d.total_overdue) > 0)
                            .sort((a,b) => b.total_overdue - a.total_overdue);

    listEl.innerHTML = overdueData.map(d => `
        <div class="flex justify-between p-3 border-b bg-red-50/30">
            <div>
                <div class="font-bold text-slate-800">${d.customer_name}</div>
                <div class="text-[10px] text-slate-500">${d.leasing_name} | Sales: ${d.salesman_name}</div>
            </div>
            <div class="text-right">
                <div class="text-red-600 font-black">${fmtIDR(d.total_overdue)}</div>
                <div class="text-[10px] text-slate-400 text-uppercase">Lewat TOP</div>
            </div>
        </div>
    `).join('');
}

// TAB 4: DATABASE LENGKAP (Tabel Mentah)
function updateTabDatabase(data) {
    const tbody = document.getElementById('table-body-database');
    if (!tbody) return;

    tbody.innerHTML = data.map((d, i) => `
        <tr class="text-[10px] border-b hover:bg-slate-50">
            <td class="p-2 text-center">${i+1}</td>
            <td class="p-2 font-bold">${d.customer_name}</td>
            <td class="p-2">${d.leasing_name || 'CASH'}</td>
            <td class="p-2">${fmtIDR(d.os_balance)}</td>
            <td class="p-2 text-red-600">${fmtIDR(d.total_overdue)}</td>
            <td class="p-2">${d.salesman_name}</td>
        </tr>
    `).join('');
}

// Fungsi Render Grafik (ApexCharts)
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