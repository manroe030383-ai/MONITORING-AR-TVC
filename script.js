import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        updateDashboard(data);
    } catch (e) { 
        console.error("Gagal tarik data:", e);
        document.getElementById('status-update').innerText = "KONEKSI GAGAL!";
    }
}

function updateDashboard(data) {
    let s = { os:0, ov:0, pen:0, lan:0, cash:0, leas:0, cOv:0, gi:0, rd:0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mapSales = {}, mapOverdue = {}, mapSpv = {}, mapLeasing = {};

    data.forEach(d => {
        // Ambil value dengan proteksi jika data null/undefined
        const valOs = Number(d.os_balance || 0);
        const valOv = Number(d.total_overdue || 0);
        const lName = (d.leasing_name || '').toUpperCase().trim();
        const sName = d.salesman_name || 'UNKNOWN';
        const spvName = d.spv_name || 'N/A';
        const custName = d.customer_name || 'CUSTOMER';

        s.os += valOs; 
        s.ov += valOv; 
        if(valOv > 0) s.cOv++;
        
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);

        // Aging Logic
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        // Grouping Data
        mapSales[sName] = (mapSales[sName] || 0) + valOs;
        mapSpv[spvName] = (mapSpv[spvName] || 0) + valOs;
        if(valOv > 0) mapOverdue[custName] = (mapOverdue[custName] || 0) + valOv;

        // Cash vs Leasing Logic
        if(["CASH", "CASH TERIMA", ""].includes(lName)) {
            s.cash += valOs;
        } else {
            s.leas += valOs;
            mapLeasing[lName] = (mapLeasing[lName] || 0) + valOs;
            
            // Perbaikan Logika GI (Done) vs R-Delivery
            const isGI = d.gl_date && d.gl_date !== "0" && d.gl_date !== "null" && d.gl_date !== "";
            if(isGI) s.gi++; else s.rd++;
        }
    });

    // Update UI Elements
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    document.getElementById('badge-overdue').innerText = `${s.cOv} SPK LEWAT TOP`;
    
    // Progress Bar (Proteksi Division by Zero)
    const cashPct = s.os > 0 ? (s.cash/s.os)*100 : 0;
    const leasPct = s.os > 0 ? (s.leas/s.os)*100 : 0;
    document.getElementById('bar-cash').style.width = `${cashPct}%`;
    document.getElementById('bar-leasing').style.width = `${leasPct}%`;

    document.getElementById('total-unit').innerText = `${data.length} Unit`;
    document.getElementById('unit-gi').innerText = s.gi;
    document.getElementById('unit-delivery').innerText = s.rd;

    renderCharts(s.cash, s.leas, aging);
    renderList('list-sales', mapSales, 'blue');
    renderList('list-overdue', mapOverdue, 'red');
    renderList('list-spv', mapSpv, 'emerald');
    renderLeasingProgress(mapLeasing, s.os);

    const now = new Date();
    document.getElementById('tgl-arsip').innerText = now.toLocaleDateString('id-ID');
    document.getElementById('status-update').innerText = `DATA UPDATE: ${now.toLocaleTimeString('id-ID')} WIB`;
    document.getElementById('status-update').classList.remove('animate-pulse');
}

// Fungsi bantu tetap sama
function renderCharts(cash, leas, aging) { ... }
function renderList(id, map, color) { ... }
function renderLeasingProgress(map, total) { ... }

document.addEventListener('DOMContentLoaded', fetchData);