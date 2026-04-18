import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Konfigurasi Supabase Anda
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};

// Helper Formatter
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

/**
 * 1. Fungsi Utama Mengambil Data dari Supabase
 */
async function fetchData() {
    try {
        const statusEl = document.getElementById('status-update');
        statusEl.innerText = "MEMUAT DATA SUPABASE...";
        statusEl.classList.add('animate-pulse');

        // Menarik data dari tabel ar_unit
        const { data, error } = await supabase
            .from('ar_unit')
            .select('*');

        if (error) throw error;

        if (data) {
            updateDashboard(data);
        }
    } catch (e) {
        console.error("Gagal menarik data:", e);
        document.getElementById('status-update').innerText = "KONEKSI DATABASE GAGAL!";
    }
}

/**
 * 2. Logika Pengolahan Data AR
 */
function updateDashboard(data) {
    // Objek penampung totalan
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cOv: 0, gi: 0, rd: 0 };
    
    // Objek untuk grafik dan list top performance
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mapSales = {}, mapOverdue = {}, mapSpv = {}, mapLeasing = {};

    data.forEach(d => {
        // Pemetaan kolom sesuai struktur DB Supabase
        const valOs = Number(d.os_balance || 0);
        const valOv = Number(d.total_overdue || 0);
        const valPen = Number(d.penalty_amount || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();

        // Akumulasi Total
        s.os += valOs;
        s.ov += valOv;
        s.pen += valPen;
        s.lan += Number(d.lancar || 0);
        if (valOv > 0) s.cOv++;

        // Hitung Aging (dalam Juta untuk grafik)
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        // Grouping Berdasarkan Sales & SPV
        const sName = d.salesman_name || 'TIDAK TERDAFTAR';
        mapSales[sName] = (mapSales[sName] || 0) + valOs;
        
        const spvName = d.spv_name || 'N/A';
        mapSpv[spvName] = (mapSpv[spvName] || 0) + valOs;

        if (valOv > 0) {
            mapOverdue[d.customer_name || 'CUSTOMER'] = (mapOverdue[d.customer_name] || 0) + valOv;
        }

        // Klasifikasi Cash vs Leasing
        if (["CASH", "CASH TERIMA", ""].includes(lName)) {
            s.cash += valOs;
        } else {
            s.leas += valOs;
            mapLeasing[lName] = (mapLeasing[lName] || 0) + valOs;
            
            // Logika Unit GI Done vs R-Delivery
            const isGI = d.gl_date && d.gl_date !== "0" && d.gl_date !== "null" && d.gl_date !== "";
            if (isGI) s.gi++; else s.rd++;
        }
    });

    // Update UI Elements (Top Cards)
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    document.getElementById('badge-overdue').innerText = `${s.cOv} SPK LEWAT TOP`;

    // Progress Bar OS
    const cashPct = s.os > 0 ? (s.cash / s.os) * 100 : 0;
    const leasPct = s.os > 0 ? (s.leas / s.os) * 100 : 0;
    document.getElementById('bar-cash').style.width = `${cashPct}%`;
    document.getElementById('bar-leasing').style.width = `${leasPct}%`;

    // Statistik Unit
    document.getElementById('total-unit').innerText = `${data.length} Unit`;
    document.getElementById('unit-gi').innerText = s.gi;
    document.getElementById('unit-delivery').innerText = s.rd;

    // Render Komponen Visual
    renderCharts(s.cash, s.leas, aging);
    renderList('list-sales', mapSales, 'blue');
    renderList('list-overdue', mapOverdue, 'red');
    renderList('list-spv', mapSpv, 'emerald');
    renderLeasingProgress(mapLeasing, s.os);

    // Update Tanggal Refresh Otomatis
    const now = new Date();
    document.getElementById('tgl-arsip').innerText = now.toLocaleDateString('id-ID');
    document.getElementById('status-update').innerText = `DATA UPDATE: ${now.toLocaleTimeString('id-ID')} WIB`;
    document.getElementById('status-update').classList.remove('animate-pulse');
}

/**
 * 3. Fungsi Render Grafik (ApexCharts)
 */
function renderCharts(cash, leas, aging) {
    // Donut Chart Leasing
    if (!charts.donut) {
        charts.donut = new ApexCharts(document.querySelector("#chart-donut-leasing"), {
            series: [cash, leas],
            labels: ['Cash', 'Leasing'],
            chart: { type: 'donut', height: 280 },
            colors: ['#10B981', '#2563EB'],
            legend: { position: 'bottom', fontFamily: 'Plus Jakarta Sans' },
            dataLabels: { enabled: false },
            plotOptions: { pie: { donut: { size: '75%' } } }
        });
        charts.donut.render();
    } else {
        charts.donut.updateSeries([cash, leas]);
    }

    // Bar Chart Aging
    if (!charts.bar) {
        charts.bar = new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Nominal (Juta)', data: Object.values(aging) }],
            chart: { type: 'bar', height: 280, toolbar: { show: false } },
            colors: ['#3B82F6'],
            plotOptions: { bar: { borderRadius: 8, columnWidth: '50%', distributed: true } },
            xaxis: { categories: Object.keys(aging) },
            yaxis: { labels: { formatter: (v) => v + " Jt" } }
        });
        charts.bar.render();
    } else {
        charts.bar.updateSeries([{ data: Object.values(aging) }]);
    }
}

/**
 * 4. Fungsi Render Tabel/List Top 5
 */
function renderList(id, map, color) {
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById(id).innerHTML = sorted.map((item, i) => `
        <div class="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
            <span class="text-[10px] font-bold text-slate-500 uppercase truncate w-40">${i + 1}. ${item[0]}</span>
            <span class="text-${color}-600 font-black text-[11px]">${fmtJuta(item[1])}</span>
        </div>`).join('');
}

/**
 * 5. Fungsi Render Progress Leasing
 */
function renderLeasingProgress(map, total) {
    document.getElementById('leasing-list').innerHTML = Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(l => {
            const p = total > 0 ? ((l[1] / total) * 100).toFixed(1) : 0;
            return `
            <div class="space-y-1">
                <div class="flex justify-between text-[10px] font-bold uppercase">
                    <span class="text-slate-400">${l[0]}</span>
                    <span class="text-[#1B2559]">${p}%</span>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                    <div class="bg-blue-600 h-full transition-all duration-700" style="width: ${p}%"></div>
                </div>
            </div>`;
        }).join('');
}

// Jalankan saat halaman dimuat
document.addEventListener('DOMContentLoaded', fetchData);

// Auto-refresh data setiap 5 menit
setInterval(fetchData, 300000);