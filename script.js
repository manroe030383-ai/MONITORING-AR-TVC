import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Pastikan URL dan Key ini benar
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

async function fetchData() {
    try {
        const statusEl = document.getElementById('status-update');
        statusEl.innerText = "SEDANG MENGHUBUNGKAN...";

        // 2. Mengambil data dari tabel 'ar_unit'
        const { data, error } = await supabase
            .from('ar_unit')
            .select('*');

        if (error) {
            console.error("Supabase Error:", error.message);
            statusEl.innerText = `KONEKSI GAGAL: ${error.message}`;
            return;
        }

        if (!data || data.length === 0) {
            statusEl.innerText = "KONEKSI BERHASIL, TAPI DATA KOSONG!";
            return;
        }

        updateDashboard(data);
        
        statusEl.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
        statusEl.classList.remove('text-red-600');
        statusEl.classList.add('text-emerald-600');

    } catch (e) {
        console.error("System Error:", e);
        document.getElementById('status-update').innerText = "ERROR SISTEM: CEK KONSOL (F12)";
    }
}

// Fungsi updateDashboard, renderCharts, dan render lainnya tetap sama seperti sebelumnya 
// agar tidak merubah struktur visual yang sudah Anda buat.
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, unitCash: 0, unitLeas: 0, cOv: 0, spkPenCount: 0 };
    let tvc = { totalUnit: 0, gi: 0, rd: 0 };
    let mapTvcDetail = { 'TAFS': 0, 'ACC': 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
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

    // Update UI Stats
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

// Pastikan fungsi renderCharts, renderTopList, dll tetap ada di bawah sini
// (Gunakan kode render yang saya berikan di balasan sebelumnya)

document.addEventListener('DOMContentLoaded', fetchData);