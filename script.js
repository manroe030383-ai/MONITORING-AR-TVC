import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let donutChart = null, barChart = null;

const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const formatJuta = (n) => (Number(n) / 1000000).toFixed(1) + " Jt";

function updateText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

async function loadData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        processDashboard(data);
        updateDateTime();
    } catch (err) {
        console.error(err);
        updateText('tgl-update-text', "ERROR SYNC");
    }
}

function processDashboard(data) {
    let tOS = 0, tOverdue = 0, tPenalty = 0, tLancar = 0, cashNom = 0, leasingNom = 0;
    let uACC = 0, uTAFS = 0, uGI = 0, uRD = 0, cOverdue = 0;
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        const os = Number(d.os_balance || 0);
        const ov = Number(d.total_overdue || d.total_overd || 0);
        const leasingName = (d.leasing_name || '').toUpperCase();
        
        tOS += os;
        tOverdue += ov;
        if (ov > 0) cOverdue++;
        tLancar += Number(d.lancar || 0);
        tPenalty += Number(d.penalty_amount || 0);

        buckets['LANCAR'] += Number(d.lancar || 0) / 1000000;
        buckets['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        buckets['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        buckets['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        if (["CASH", "CASH TERIMA", ""].includes(leasingName.trim())) {
            cashNom += os;
        } else {
            leasingNom += os;
            if (leasingName.includes("ACC")) uACC++;
            if (leasingName.includes("TAFS")) uTAFS++;
            if (d.gl_date && d.gl_date !== "0") uGI++; else uRD++;
        }
    });

    updateText('total-os', formatIDR(tOS));
    updateText('total-overdue', formatIDR(tOverdue));
    updateText('count-overdue-spk', `${cOverdue} SPK LEWAT TOP`);
    updateText('total-lancar', formatIDR(tLancar));
    updateText('total-penalty', formatIDR(tPenalty));
    updateText('val-total-cash', formatIDR(cashNom));
    updateText('val-total-leasing', formatIDR(leasingNom));
    
    // Leasing TVC Section
    updateText('total-penjualan-leasing', `${uACC + uTAFS} Unit`);
    updateText('unit-sudah-gi', uGI);
    updateText('unit-r-delivery', uRD);

    // Progress Bar
    document.getElementById('bar-cash').style.width = `${(cashNom/tOS)*100}%`;
    document.getElementById('bar-leasing').style.width = `${(leasingNom/tOS)*100}%`;

    renderCharts(cashNom, leasingNom, Object.values(buckets));
    renderSalesList(data);
    renderTopSPV(data, tOS);
    renderOverdueList(data);
    renderLeasingBreakdown(data, tOS);
}

function renderSalesList(data) {
    const map = {};
    data.forEach(d => { map[d.salesman_name || 'N/A'] = (map[d.salesman_name] || 0) + Number(d.os_balance || 0); });
    const sorted = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,5);
    document.getElementById('list-salesman').innerHTML = sorted.map((s, i) => `
        <div class="flex justify-between items-center py-1">
            <span class="text-[10px] font-bold text-slate-600 truncate w-32">${i+1}. ${s[0]}</span>
            <span class="text-blue-600 font-black text-[10px]">${formatJuta(s[1])}</span>
        </div>`).join('');
}

// Fungsi Chart, SPV List, Overdue List, dan Breakdown (Logika sama seperti sebelumnya)
// ... [Tambahkan fungsi renderCharts, renderTopSPV, renderOverdueList yang sudah ada] ...

function updateDateTime() {
    const now = new Date();
    updateText('tgl-arsip', `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`);
    updateText('tgl-update-text', `DATA UPDATE: ${now.toLocaleTimeString()} WIB`);
}

document.addEventListener('DOMContentLoaded', loadData);
setInterval(loadData, 300000);