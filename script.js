import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) updateDashboard(data);
    } catch (e) { console.error("Error Fetching:", e); }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0 };
    let mapTvcDetail = { 'TAFS': 0, 'ACC': 0 };
    let mapSales = {}, mapOverdue = {}, mapLeasing = {};
    
    // Objek untuk menampung Data SPV (Nominal & Unit)
    let mapSpv = {}; 

    data.forEach(d => {
        const valOs = Number(d.os_balance || 0);
        const lName = (d.leasing_name || 'CASH').toUpperCase().trim();
        const spvName = d.spv_name || 'N/A';

        s.os += valOs;
        
        // Mapping Leasing TVC (Hanya TAFS & ACC)
        if (lName === 'TAFS' || lName === 'ACC') {
            mapTvcDetail[lName]++;
        }

        // Logic Mapping SPV (Data Baru: Nominal & Unit)
        if (!mapSpv[spvName]) mapSpv[spvName] = { nominal: 0, unit: 0 };
        mapSpv[spvName].nominal += valOs;
        mapSpv[spvName].unit += 1;

        // Lainnya
        mapSales[d.salesman_name || 'N/A'] = (mapSales[d.salesman_name] || 0) + valOs;
    });

    document.getElementById('total-os').innerText = fmtIDR(s.os);
    
    // Render fungsi khusus SPV
    renderTopSpv(mapSpv, s.os);
    
    // Render fungsi lainnya (tetap sama)
    renderTopList('list-sales', mapSales, 'text-blue-600');
    renderTvcList(mapTvcDetail);
}

// KHUSUS PERBAIKAN TOP SPV AGAR IDENTIK DENGAN REFERENSI
function renderTopSpv(map, totalOs) {
    const sorted = Object.entries(map)
        .sort((a, b) => b[1].nominal - a[1].nominal)
        .slice(0, 5);

    document.getElementById('list-spv').innerHTML = sorted.map(([name, data], i) => {
        const pct = totalOs > 0 ? ((data.nominal / totalOs) * 100).toFixed(1) : 0;
        
        return `
        <div class="space-y-1.5">
            <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold text-slate-300">${i + 1}.</span>
                    <span class="text-[11px] font-extrabold text-slate-700 uppercase truncate w-40">${name}</span>
                </div>
                <span class="text-[#6D28D9] font-black text-[11px]">${fmtJuta(data.nominal)}</span>
            </div>
            
            <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                <div class="absolute top-0 left-0 h-full bg-[#A855F7] rounded-full" style="width: ${pct}%"></div>
            </div>
            
            <div class="flex justify-end items-center gap-2 text-[9px] font-bold text-slate-400">
                <span>${pct}% Global</span>
                <span class="text-slate-200">•</span>
                <span class="text-[#6D28D9] font-extrabold">${data.unit} Unit</span>
            </div>
        </div>`;
    }).join('');
}

function renderTvcList(map) {
    document.getElementById('tvc-detail-list').innerHTML = `
        <div class="text-sm font-bold">ACC: ${map['ACC']} Unit</div>
        <div class="text-sm font-bold">TAFS: ${map['TAFS']} Unit</div>
    `;
}

function renderTopList(id, map, colorClass) {
    const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 5);
    document.getElementById(id).innerHTML = sorted.map((item, i) => `
        <div class="flex justify-between text-[10px] border-b border-slate-50 pb-2">
            <span>${i+1}. ${item[0]}</span>
            <span class="${colorClass} font-bold">${fmtJuta(item[1])}</span>
        </div>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);