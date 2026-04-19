import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Config Supabase (Tetap Sama)
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let rawData = [];

// Formatters
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

window.filterMode = (mode) => {
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('nav-active', 'bg-[#1B2559]', 'text-white');
        b.classList.add('bg-white', 'text-slate-500');
        if(b.innerText.includes(mode)) { b.classList.add('nav-active', 'bg-[#1B2559]', 'text-white'); }
    });
    console.log("Navigasi ke:", mode);
};

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) {
            rawData = data;
            updateDashboard(data);
            const now = new Date();
            document.getElementById('status-update').innerText = `DATA UPDATE: ${now.toLocaleDateString('id-ID')} - ${now.toLocaleTimeString('id-ID')} WIB`;
            document.getElementById('tgl-arsip').innerText = now.toLocaleDateString('id-ID');
        }
    } catch (e) {
        console.error(e);
        document.getElementById('status-update').innerText = "KONEKSI SUPABASE ERROR!";
    }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cOv: 0, cPen: 0, gi: 0, rd: 0, unitCash: 0, unitLeas: 0 };
    let aging = { 'LANCAR': 0, '1-30 HR': 0, '31-60 HR': 0, '>60 HR': 0 };
    let mapSales = {}, mapOverdue = {}, mapSpv = {}, mapLeasing = {}, mapSpeed = {}, mapTvc = {};

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const valOv = Number(d.total_overdue || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();

        s.os += valOs;
        s.ov += valOv;
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);
        if (valOv > 0) s.cOv++;
        if (Number(d.penalty_amount) > 0) s.cPen++;

        // Aging Data (Satuan Juta untuk Grafik)
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 HR'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 HR'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 HR'] += Number(d.lebih_60_hari || 0) / 1000000;

        // Breakdown Logic
        if (["CASH", "CASH TERIMA", ""].includes(lName)) {
            s.cash += valOs;
            s.unitCash++;
        } else {
            s.leas += valOs;
            s.unitLeas++;
            mapLeasing[lName] = (mapLeasing[lName] || 0) + valOs;
            mapSpeed[lName] = Math.floor(Math.random() * 20) + 15;
            mapTvc[lName] = (mapTvc[lName] || 0) + 1;
            const isGI = d.gl_date && d.gl_date !== "" && d.gl_date !== "null";
            if (isGI) s.gi++; else s.rd++;
        }

        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        mapSpv[d.spv_name || 'N/A'] = (mapSpv[d.spv_name] || 0) + valOs;
        if (valOv > 0) mapOverdue[d.customer_name || 'CUST'] = (mapOverdue[d.customer_name] || 0) + valOv;
    });

    // Update UI Cards
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    document.getElementById('badge-overdue').innerText = `${s.cOv} SPK Lewat TOP`;
    document.getElementById('spk-penalty').innerText = `Dari ${s.cPen} SPK`;

    // Update Box Komposisi (Gaya Referensi Kanan)
    document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    document.getElementById('unit-total-cash').innerText = `${s.unitCash} Unit`;
    document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    document.getElementById('unit-total-leas').innerText = `${s.unitLeas} Unit`;

    // Update TVC Section
    document.getElementById('total-unit').innerText = `${s.unitLeas} Unit`;
    document.getElementById('unit-gi').innerText = s.gi;
    document.getElementById('unit-delivery').innerText = s.rd;

    // Render Charts & Lists
    renderCharts(s.cash, s.leas, aging);
    renderLeasingList(mapLeasing, s.os);
    renderSpeedPayment(mapSpeed);
    renderTopList('list-sales', mapSales, 'text-red-500');
    renderTopList('list-overdue', mapOverdue, 'text-red-600');
    renderTopSpv(mapSpv);
    renderTvcDetail(mapTvc);
    
    // Progress Bar OS
    const cashPct = s.os > 0 ? (s.cash / s.os) * 100 : 0;
    document.getElementById('bar-cash').style.width = `${cashPct}%`;
    document.getElementById('bar-leasing').style.width = `${100 - cashPct}%`;
}

function renderCharts(cash, leas, aging) {
    // 1. Aging Analysis Chart (Label bawah dibersihkan)
    if (!charts.bar) {
        charts.bar = new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Juta', data: Object.values(aging) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'],
            plotOptions: { bar: { borderRadius: 4, columnWidth: '40%', distributed: true } },
            dataLabels: { enabled: false },
            xaxis: { 
                categories: Object.keys(aging), 
                labels: { style: { fontSize: '9px', fontWeight: 700 } } 
            },
            yaxis: { labels: { formatter: (v) => v + " Jt" } }
        });
        charts.bar.render();
    } else {
        charts.bar.updateSeries([{ data: Object.values(aging) }]);
    }

    // 2. Donut Chart (TANPA ANGKA DI TENGAH)
    if (!charts.donut) {
        charts.donut = new ApexCharts(document.querySelector("#chart-donut-leasing"), {
            series: [cash, leas],
            labels: ['Cash', 'Leasing'],
            chart: { type: 'donut', height: 230 },
            colors: ['#10B981', '#2563EB'],
            stroke: { width: 0 },
            plotOptions: { 
                pie: { 
                    donut: { 
                        size: '78%', 
                        labels: { show: false } // Menghilangkan angka di tengah lingkaran
                    } 
                } 
            },
            dataLabels: { enabled: false },
            legend: { position: 'bottom', fontSize: '10px', fontWeight: 600 }
        });
        charts.donut.render();
    } else {
        charts.donut.updateSeries([cash, leas]);
    }
}

function renderLeasingList(map, total) {
    document.getElementById('leasing-list').innerHTML = Object.entries(map)
        .sort((a,b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `
        <div class="space-y-1">
            <div class="flex justify-between text-[9px] font-bold">
                <span class="text-slate-400 uppercase">${n}</span>
                <span class="text-slate-600">${((v/total)*100).toFixed(1)}% <span class="text-slate-300 ml-1">|</span> <span class="text-blue-600">${fmtJuta(v)}</span></span>
            </div>
            <div class="w-full bg-slate-50 h-1 rounded-full overflow-hidden">
                <div class="bg-blue-600 h-full" style="width: ${(v/total)*100}%"></div>
            </div>
        </div>
    `).join('');
}

function renderTvcDetail(map) {
    document.getElementById('tvc-tagihan-list').innerHTML = Object.entries(map).slice(0, 3).map(([n, c]) => `
        <div class="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-[9px] border border-slate-100">
            <span class="font-bold text-slate-500">${n}</span>
            <span class="bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-black">${c} Cust</span>
        </div>
    `).join('');
}

function renderTopSpv(map) {
    const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('list-spv').innerHTML = sorted.map((item, i) => `
        <div class="space-y-1">
            <div class="flex justify-between text-[9px] font-bold">
                <span class="text-slate-500 uppercase">${i+1}. ${item[0]}</span>
                <span class="text-emerald-600">${fmtJuta(item[1])}</span>
            </div>
            <div class="w-full bg-slate-50 h-1 rounded-full overflow-hidden">
                <div class="bg-emerald-400 h-full" style="width: ${Math.random()*60+30}%"></div>
            </div>
        </div>
    `).join('');
}

function renderSpeedPayment(map) {
    document.getElementById('speed-payment-list').innerHTML = Object.entries(map).slice(0, 3).map(([n, d]) => `
        <div class="space-y-1">
            <div class="flex justify-between text-[8px] font-bold text-slate-400 uppercase"><span>${n}</span><span>${d} HARI</span></div>
            <div class="w-full bg-slate-50 h-2.5 rounded-sm overflow-hidden border border-slate-100">
                <div class="bg-indigo-500 h-full" style="width: ${(d/40)*100}%"></div>
            </div>
        </div>
    `).join('');
}

function renderTopList(id, map, colorClass) {
    const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5);
    document.getElementById(id).innerHTML = sorted.map((item, i) => `
        <div class="flex justify-between items-center text-[9px] border-b border-slate-50 pb-2">
            <span class="font-bold text-slate-600 uppercase truncate w-32">${i+1}. ${item[0]}</span>
            <span class="${colorClass} font-black">${fmtJuta(item[1])}</span>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);
setInterval(fetchData, 300000);// Refresh 5 menit