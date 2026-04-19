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
        if (data) updateDashboard(data);
    } catch (e) { console.error(e); }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, unitCash: 0, unitLeas: 0, cOv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    
    // Data Khusus TVC (ACC & TAFS)
    let tvc = { total: 0, gi: 0, rd: 0, acc: 0, tafs: 0 };
    
    let mapLeasing = {}, mapSales = {}, mapOverdue = {}, mapSpv = {}, mapSpvUnits = {};

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();
        
        s.os += valOs;
        s.ov += Number(d.total_overdue || 0);
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);
        if (Number(d.total_overdue) > 0) s.cOv++;

        // Hitung Aging (dalam Juta)
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        // Logika Cash vs Leasing
        if (["CASH", "CASH TERIMA", ""].includes(lName)) {
            s.cash += valOs; s.unitCash++;
        } else {
            s.leas += valOs; s.unitLeas++;
            mapLeasing[lName] = (mapLeasing[lName] || 0) + valOs;

            // Filter Khusus TVC (ACC & TAFS)
            if (lName.includes('ACC') || lName.includes('TAFS')) {
                tvc.total++;
                if (d.gl_date) tvc.gi++; else tvc.rd++;
                if (lName.includes('ACC')) tvc.acc++;
                if (lName.includes('TAFS')) tvc.tafs++;
            }
        }

        // Mapping SPV & Sales
        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        mapSpv[d.spv_name || 'N/A'] = (mapSpv[d.spv_name] || 0) + valOs;
        mapSpvUnits[d.spv_name || 'N/A'] = (mapSpvUnits[d.spv_name] || 0) + 1;
        
        if (Number(d.total_overdue) > 0) {
            mapOverdue[d.customer_name || 'CUST'] = (mapOverdue[d.customer_name] || 0) + Number(d.total_overdue);
        }
    });

    // Update Card Stats Utama
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);

    // Update Breakdown Leasing TVC (Sesuai Referensi)
    document.getElementById('tvc-total-unit').innerText = `${tvc.total} Unit`;
    document.getElementById('tvc-gi').innerText = `${tvc.gi} Unit`;
    document.getElementById('tvc-delivery').innerText = `${tvc.rd} Unit`;
    document.getElementById('list-tvc-detail').innerHTML = `
        <div class="flex justify-between p-2 bg-slate-50 rounded-lg text-[9px] font-bold border border-slate-100">
            <span>1. ACC</span><span class="bg-yellow-400 px-2 rounded font-black">${tvc.acc} Cust</span>
        </div>
        <div class="flex justify-between p-2 bg-slate-50 rounded-lg text-[9px] font-bold border border-slate-100">
            <span>2. TAFS</span><span class="bg-yellow-400 px-2 rounded font-black">${tvc.tafs} Cust</span>
        </div>`;

    // Update Top SPV AR Distribution (Sesuai Referensi)
    document.getElementById('list-spv-dist').innerHTML = Object.entries(mapSpv).sort((a,b) => b[1]-a[1]).map(([name, val]) => {
        const pct = s.os > 0 ? ((val/s.os)*100).toFixed(1) : 0;
        return `<div class="space-y-1">
            <div class="flex justify-between text-[9px] font-bold uppercase"><span>${name}</span><span class="text-indigo-600">${fmtJuta(val)}</span></div>
            <div class="flex items-center gap-2">
                <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div class="bg-purple-500 h-full" style="width:${pct}%"></div>
                </div>
                <span class="text-[8px] font-bold text-slate-400 w-24 text-right">${pct}% Global • ${mapSpvUnits[name] || 0} Unit</span>
            </div>
        </div>`;
    }).join('');

    // Update Top List Sales & Overdue
    renderTopList('list-sales', mapSales, 'text-blue-600');
    renderTopList('list-overdue', mapOverdue, 'text-red-600');

    // Update Progress Bar O/S Balance
    const cashPct = s.os > 0 ? (s.cash / s.os) * 100 : 0;
    document.getElementById('bar-cash').style.width = `${cashPct}%`;
    document.getElementById('bar-leasing').style.width = `${100 - cashPct}%`;

    renderCharts(s.cash, s.leas, aging);
    
    document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleTimeString()} WIB`;
}

function renderCharts(cash, leas, aging) {
    // 1. Grafik Aging Analysis (PERBAIKAN WARNA & DATA LABELS)
    if (!charts.bar) {
        charts.bar = new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Juta', data: Object.values(aging) }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            // Warna berbeda tiap batang: Hijau, Kuning, Oranye, Merah
            colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'], 
            plotOptions: { 
                bar: { 
                    borderRadius: 6, 
                    columnWidth: '45%', 
                    distributed: true // Penting agar warna berbeda-beda
                } 
            },
            // Menghilangkan angka di dalam batang
            dataLabels: { enabled: false }, 
            xaxis: { 
                categories: ['LANCAR', '1-30 H', '31-60 H', '>60 H'],
                labels: { style: { fontSize: '9px', fontWeight: 700 } } 
            },
            yaxis: { labels: { formatter: (v) => v + " Jt" } },
            legend: { show: false }, 
            grid: { borderColor: '#f1f5f9' }
        });
        charts.bar.render();
    } else { charts.bar.updateSeries([{ data: Object.values(aging) }]); }

    // 2. Grafik Donut (Komposisi)
    if (!charts.donut) {
        charts.donut = new ApexCharts(document.querySelector("#chart-donut-leasing"), {
            series: [cash, leas],
            labels: ['Cash', 'Leasing'],
            chart: { type: 'donut', height: 230 },
            colors: ['#10B981', '#2563EB'],
            stroke: { width: 0 },
            plotOptions: { pie: { donut: { size: '78%', labels: { show: false } } } },
            dataLabels: { enabled: false },
            legend: { position: 'bottom', fontSize: '10px', fontWeight: 600 }
        });
        charts.donut.render();
    } else { charts.donut.updateSeries([cash, leas]); }
}

function renderTopList(id, map, colorClass) {
    document.getElementById(id).innerHTML = Object.entries(map)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5)
        .map((item, i) => `
            <div class="flex justify-between items-center text-[9px] border-b border-slate-50 pb-2">
                <span class="font-bold text-slate-600 uppercase truncate w-32">${i+1}. ${item[0]}</span>
                <span class="${colorClass} font-black">${fmtJuta(item[1])}</span>
            </div>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);