import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let currentTab = 'DATABASE LENGKAP'; // State awal tab aktif
let globalMasterData = [];          // Cadangan data murni dari database

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*').order('os_balance', { ascending: false });
        if (error) throw error;
        if (data) {
            globalMasterData = data; 
            updateDashboard(data);
            document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
            document.getElementById('status-update').classList.replace('text-red-600', 'text-emerald-600');
        }
    } catch (e) {
        console.error(e);
        if(document.getElementById('status-update')) document.getElementById('status-update').innerText = "KONEKSI GAGAL!";
    }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {}, mOverdueTop = [];

    data.forEach(d => {
        const os = Number(d.os_balance || 0);
        const ov = Number(d.total_overdue || 0);
        const l = (d.leasing_name || 'CASH').toUpperCase().trim();
        
        s.os += os; s.ov += ov; s.pen += Number(d.penalty_amount || 0); s.lan += Number(d.lancar || 0);
        if (ov > 0) { s.countOv++; mOverdueTop.push(d); }
        if (Number(d.penalty_amount) > 0) s.cPen++;

        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        if (["CASH", "CASH TERIMA", ""].includes(l)) { 
            s.cash += os; s.cCash++; 
        } else { 
            s.leas += os; s.cLeas++; 
            mLeas[l] = (mLeas[l] || 0) + os; 
            if (l.includes('TAFS') || l.includes('ACC')) {
                tvc.total++;
                if (d.status_tagih === 'SUDAH GI') tvc.gi++;
                else tvc.deliv++;
            }
        }

        const rawSales = (d.salesman_name || "").trim();
        const rawSpv = (d.supervisor_name || "").trim();
        const finalSales = rawSales !== "" ? rawSales : (rawSpv !== "" ? rawSpv : "OFFICE");
        const finalSpv = rawSpv !== "" ? rawSpv : "OFFICE";

        mSales[finalSales] = (mSales[finalSales] || 0) + os;
        mSpv[finalSpv] = (mSpv[finalSpv] || 0) + os;
    });

    // Update elemen widget ringskasan jika ada di halaman
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    if(document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    
    renderAgingChart(aging);
    renderDonutLeasing(mLeas);
    
    // Jalankan render tabel utama secara menyeluruh
    renderTabelDataUtama(data);
}

function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging");
    if (!el) return;
    const options = {
        series: [{ name: 'Juta', data: Object.values(agingData).map(v => Math.round(v)) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: (v) => v + " Jt", style: { fontSize: '9px', fontWeight: 800 }, offsetY: -20 },
        xaxis: { categories: Object.keys(agingData), labels: { style: { fontSize: '9px', fontWeight: 700 } } },
        yaxis: { show: false },
        grid: { show: false }
    };
    if (charts.bar) charts.bar.updateOptions(options);
    else { charts.bar = new ApexCharts(el, options); charts.bar.render(); }
}

function renderDonutLeasing(mLeas) {
    const el = document.querySelector("#chart-donut-leasing");
    if (!el) return;
    const options = {
        series: Object.values(mLeas),
        labels: Object.keys(mLeas),
        chart: { type: 'donut', height: 180 },
        legend: { show: false },
        dataLabels: { enabled: false },
        colors: ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E']
    };
    if (charts.donut) charts.donut.updateOptions(options);
    else { charts.donut = new ApexCharts(el, options); charts.donut.render(); }
}


// ================= FUNGSI RE-RENDER TABEL ANTI-GAGAL =================
function renderTabelDataUtama(data) {
    const tbody = document.getElementById('tab-database-body');
    if (!tbody) return;

    let filteredData = data;

    // 1. Filter data secara presisi sesuai Tab Aktif
    if (currentTab === 'LEASING') {
        // Hanya tampilkan unit non-CASH (Leasing)
        filteredData = data.filter(d => {
            const l = (d.leasing_name || 'CASH').toUpperCase().trim();
            return !["CASH", "CASH TERIMA", ""].includes(l);
        });
    } else if (currentTab === 'OVERDUE') {
        // Hanya tampilkan data yang benar-benar menunggak (total_overdue > 0)
        filteredData = data.filter(d => Number(d.total_overdue || 0) > 0);
    }

    // 2. Tulis data baris demi baris ke dalam tabel HTML asli bawaan template
    tbody.innerHTML = filteredData.map((d, i) => {
        const isLeasingMode = (currentTab === 'LEASING');
        const isOverdueMode = (currentTab === 'OVERDUE');

        return `
        <tr class="hover:bg-slate-50 transition-colors uppercase font-bold text-xs">
            <td class="p-4 text-slate-400 text-center">${i + 1}</td>
            <td class="p-4">
                <p class="font-bold text-slate-800 text-[11px]">${d.customer_name}</p>
                <p class="text-[8px] text-slate-400 font-normal">SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
            </td>
            <td class="p-4 text-slate-600">
                <span class="${d.leasing_name && d.leasing_name !== 'CASH' ? 'bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px]' : ''}">
                    ${d.leasing_name || 'CASH'}
                </span>
            </td>
            
            ${isOverdueMode ? `<td class="p-4 text-right font-black text-red-600 bg-red-50/20 cell-overdue-value">${fmtIDR(d.total_overdue)}</td>` : ''}
            
            <td class="p-4 text-right font-black text-blue-600">${fmtIDR(d.os_balance)}</td>
            
            <td class="p-4 cell-plan-bayar"><input type="text" class="border p-1 rounded text-[10px] w-full" placeholder="Tgl Rencana..." value="${d.plan_bayar || ''}"></td>
            <td class="p-4 cell-ket-leasing"><input type="text" class="border p-1 rounded text-[10px] w-full" placeholder="Keterangan..." value="${d.keterangan_leasing || ''}"></td>
            <td class="p-4 text-center cell-aksi-simpan"><button class="bg-slate-100 hover:bg-emerald-500 hover:text-white p-1 rounded">💾</button></td>
        </tr>`;
    }).join('');

    // 3. Sesuaikan struktur header (Th) dan sembunyikan kolom inputan lewat fungsi CSS helper
    sinkronkanStrukturKolomTabel(filteredData.length);
}

// Fungsi helper penataan visual kolom (Header Th & Body Td) agar singkron tanpa merusak DOM
function sinkronkanStrukturKolomTabel(totalRow) {
    const table = document.getElementById('tab-database-body')?.closest('table');
    if (!table) return;

    const thead = table.querySelector('thead tr');
    if (!thead) return;

    // SINKRONISASI TAMPILAN HEADER (THEAD) BERDASARKAN TAB AKTIF
    if (currentTab === 'LEASING') {
        thead.innerHTML = `
            <th class="p-4 text-center w-12">NO</th>
            <th class="p-4">CUSTOMER NAME</th>
            <th class="p-4">LEASING</th>
            <th class="p-4 text-right">O/S BALANCE</th>
            <th class="p-4 cell-plan-bayar" style="display:none">PLAN BAYAR</th>
            <th class="p-4 cell-ket-leasing" style="display:none">KETERANGAN LEASING</th>
            <th class="p-4 text-center cell-aksi-simpan" style="display:none">AKSI</th>
        `;
    } else if (currentTab === 'OVERDUE') {
        thead.innerHTML = `
            <th class="p-4 text-center w-12">NO</th>
            <th class="p-4">CUSTOMER NAME</th>
            <th class="p-4">LEASING</th>
            <th class="p-4 text-right text-red-600 bg-red-50/40">TOTAL OVERDUE</th>
            <th class="p-4 text-right">O/S BALANCE</th>
            <th class="p-4 cell-plan-bayar">PLAN BAYAR (CABANG)</th>
            <th class="p-4 cell-ket-leasing">KETERANGAN LEASING</th>
            <th class="p-4 text-center cell-aksi-simpan">AKSI</th>
        `;
    } else {
        // Default: DATABASE LENGKAP
        thead.innerHTML = `
            <th class="p-4 w-12 text-center">NO</th>
            <th class="p-4">CUSTOMER NAME</th>
            <th class="p-4">LEASING</th>
            <th class="p-4 text-right">O/S BALANCE</th>
            <th class="p-4 cell-plan-bayar">PLAN BAYAR (CABANG)</th>
            <th class="p-4 cell-ket-leasing">KETERANGAN LEASING</th>
            <th class="p-4 text-center cell-aksi-simpan">AKSI</th>
        `;
    }

    // MANIPULASI ELEMENT BARIS INPUT BERDASARKAN DISPLAY STYLE
    const planCells = table.querySelectorAll('.cell-plan-bayar');
    const ketCells = table.querySelectorAll('.cell-ket-leasing');
    const aksiCells = table.querySelectorAll('.cell-aksi-simpan');

    if (currentTab === 'LEASING') {
        planCells.forEach(c => c.style.display = 'none');
        ketCells.forEach(c => c.style.display = 'none');
        aksiCells.forEach(c => c.style.display = 'none');
    } else {
        planCells.forEach(c => c.style.display = '');
        ketCells.forEach(c => c.style.display = '');
        aksiCells.forEach(c => c.style.display = '');
    }

    // Update nilai Badge total data/customer di samping teks judul panel putih Anda
    const badgeContainer = document.querySelector('.bg-white span, .rounded-2xl span, .rounded-xl span');
    if (badgeContainer && !badgeContainer.id) {
        badgeContainer.innerText = `${totalRow} CUSTOMER`;
    }
}

// ================= HANDLER PASANG KLIK NAVIGATION TAB =================
document.addEventListener('click', function (e) {
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'DIV' || e.target.tagName === 'SPAN')) {
        const txt = e.target.innerText.toUpperCase().trim();
        
        if (['LEASING', 'OVERDUE', 'DATABASE LENGKAP'].includes(txt)) {
            currentTab = txt;
            
            // Atur CSS tombol aktif dan tidak aktif
            const siblingButtons = e.target.parentElement.children;
            for (let btn of siblingButtons) {
                btn.className = "px-4 py-2 text-xs font-bold rounded-lg transition-all bg-white text-slate-600 border border-slate-100";
            }
            e.target.className = "px-4 py-2 text-xs font-bold rounded-lg transition-all bg-blue-950 text-white shadow-sm"; 

            // Ubah teks judul statis di dalam Box Putih Utama Anda
            const boxTitle = document.querySelector('.bg-white h3, .bg-white div font, .rounded-2xl div h3');
            if (boxTitle) {
                if (currentTab === 'LEASING') boxTitle.innerText = "📊 DETAIL KONTRIBUSI LEASING";
                if (currentTab === 'OVERDUE') boxTitle.innerText = "🚨 SEMUA DATA OVERDUE UNIT";
                if (currentTab === 'DATABASE LENGKAP') boxTitle.innerText = "📝 DATABASE LENGKAP AR UNIT";
            }

            // Picu penyaringan data tabel secara instan tanpa mengosongkan layar
            renderTabelDataUtama(globalMasterData);
        }
    }
});

document.addEventListener('DOMContentLoaded', fetchData);