import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

async function fetchData() {
    const { data, error } = await supabase.from('ar_unit').select('*');
    if (data) updateDashboard(data);
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    
    // Data TVC (ACC & TAFS)
    let tvc = { total: 0, gi: 0, delivery: 0, accCust: 0, tafsCust: 0 };
    
    let mapSales = {}, mapOverdue = {}, mapSpv = {}, mapSpvUnits = {};

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase();
        
        s.os += valOs;
        s.ov += Number(d.total_overdue || 0);
        s.pen += Number(d.penalty_amount || 0);
        s.lan += Number(d.lancar || 0);

        // Filter TVC (ACC & TAFS)
        if (lName.includes('ACC') || lName.includes('TAFS')) {
            tvc.total++;
            if (d.gl_date) tvc.gi++; else tvc.delivery++;
            if (lName.includes('ACC')) tvc.accCust++;
            if (lName.includes('TAFS')) tvc.tafsCust++;
        }

        // Mapping SPV Distribution
        const spv = d.spv_name || 'N/A';
        mapSpv[spv] = (mapSpv[spv] || 0) + valOs;
        mapSpvUnits[spv] = (mapSpvUnits[spv] || 0) + 1;

        // Lainnya
        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
        if (Number(d.total_overdue) > 0) {
            mapOverdue[d.customer_name] = { val: (mapOverdue[d.customer_name]?.val || 0) + Number(d.total_overdue), days: d.aging_days };
        }
    });

    // Update TVC UI
    document.getElementById('tvc-total-unit').innerText = `${tvc.total} Unit`;
    document.getElementById('tvc-gi').innerText = `${tvc.gi} Unit`;
    document.getElementById('tvc-delivery').innerText = `${tvc.delivery} Unit`;
    document.getElementById('list-tvc-detail').innerHTML = `
        <div class="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
            <span class="text-[9px] font-bold">1. ACC</span>
            <span class="bg-yellow-400 text-[9px] font-black px-2 py-0.5 rounded">${tvc.accCust} Cust</span>
        </div>
        <div class="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
            <span class="text-[9px] font-bold">2. TAFS</span>
            <span class="bg-yellow-400 text-[9px] font-black px-2 py-0.5 rounded">${tvc.tafsCust} Cust</span>
        </div>`;

    // Update SPV Distribution UI
    const sortedSpv = Object.entries(mapSpv).sort((a,b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('list-spv-dist').innerHTML = sortedSpv.map(([name, val]) => {
        const pct = ((val / s.os) * 100).toFixed(1);
        return `
            <div class="space-y-1">
                <div class="flex justify-between text-[9px] font-bold uppercase">
                    <span>${name}</span>
                    <span class="text-blue-700">${fmtJuta(val)}</span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div class="bg-indigo-500 h-full" style="width: ${pct}%"></div>
                    </div>
                    <span class="text-[8px] font-bold text-slate-400 w-16 text-right">${pct}% Global • <span class="text-slate-600">${mapSpvUnits[name]} Unit</span></span>
                </div>
            </div>`;
    }).join('');

    // Update Top Sales & Overdue
    document.getElementById('list-sales').innerHTML = Object.entries(mapSales).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => `
        <div class="flex justify-between border-b border-slate-50 pb-1"><span>${n}</span><span class="font-bold text-blue-600">${fmtJuta(v)}</span></div>`).join('');
    
    document.getElementById('list-overdue').innerHTML = Object.entries(mapOverdue).sort((a,b) => b.val - a.val).slice(0, 5).map(([n, d]) => `
        <div class="flex justify-between border-b border-slate-50 pb-1">
            <div class="flex flex-col"><span class="font-bold uppercase">${n}</span><span class="bg-red-600 text-white text-[7px] px-1 rounded w-fit">Max ${d.days} Hari</span></div>
            <span class="font-bold text-red-600">${fmtIDR(d.val)}</span>
        </div>`).join('');

    // Update Stats Utama
    document.getElementById('total-os').innerText = fmtIDR(s.os);
    document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleTimeString()} WIB`;
}

document.addEventListener('DOMContentLoaded', fetchData);