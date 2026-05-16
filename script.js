import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let currentTab = 'RINGKASAN'; // Default tab pertama saat dimuat
let globalMasterData = [];    // Menyimpan cadangan data asli Supabase

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
        document.getElementById('status-update').innerText = "KONEKSI GAGAL!";
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

        // Aging Logic
        aging['LANCAR'] += Number(d.lancar || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        // Cash vs Leasing
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

        // LOGIKA DINAMIS NAMA SALESMAN & SUPERVISOR
        const rawSales = (d.salesman_name || "").trim();
        const rawSpv = (d.supervisor_name || "").trim();
        const finalSales = rawSales !== "" ? rawSales : (rawSpv !== "" ? rawSpv : "OFFICE");
        const finalSpv = rawSpv !== "" ? rawSpv : "OFFICE";

        mSales[finalSales] = (mSales[finalSales] || 0) + os;
        mSpv[finalSpv] = (mSpv[finalSpv] || 0) + os;
    });

    // Periksa keberadaan elemen sebelum mengisi data (menghindari error jika elemen disembunyikan di HTML)
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    if(document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    if(document.getElementById('badge-overdue')) document.getElementById('badge-overdue').innerText = `${s.countOv} SPK LEWAT TOP`;
    if(document.getElementById('spk-penalty')) document.getElementById('spk-penalty').innerText = `${s.cPen} SPK`;
    
    if(document.getElementById('bar-cash')) document.getElementById('bar-cash').style.width = `${(s.cash/s.os)*100}%`;
    if(document.getElementById('bar-leasing')) document.getElementById('bar-leasing').style.width = `${(s.leas/s.os)*100}%`;
    if(document.getElementById('val-total-cash')) document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    if(document.getElementById('unit-total-cash')) document.getElementById('unit-total-cash').innerText = `${s.cCash} Unit`;
    if(document.getElementById('val-total-leas')) document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    if(document.getElementById('unit-total-leas')) document.getElementById('unit-total-leas').innerText = `${s.cLeas} Unit`;

    if(document.getElementById('total-unit-tvc')) document.getElementById('total-unit-tvc').innerText = `${tvc.total} Unit`;
    if(document.getElementById('unit-gi-tvc')) document.getElementById('unit-gi-tvc').innerText = `${tvc.gi} Unit`;
    if(document.getElementById('unit-delivery-tvc')) document.getElementById('unit-delivery-tvc').innerText = `${tvc.deliv} Unit`;

    renderAgingChart(aging);
    renderDonutLeasing(mLeas);
    renderLeasingList(mLeas, s.os);
    renderTopList(mSales, 'list-sales', 'text-blue-600');
    renderTopList(mSpv, 'list-spv', 'text-purple-600');
    renderOverdueTop(mOverdueTop);
    
    // Jalankan sistem distribusi data halaman/tab
    renderKontenPerTab(data);
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

function renderLeasingList(map, total) {
    const el = document.getElementById('leasing-list');
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n, v]) => `
        <div class="mb-3">
            <div class="flex justify-between text-[9px] font-bold mb-1 uppercase"><span>${n}</span><span>${((v/total)*100).toFixed(1)}%</span></div>
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div class="bg-blue-600 h-full" style="width: ${(v/total)*100}%"></div></div>
        </div>`).join('');
}

function renderTopList(map, id, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map((x,i) => `
        <div class="flex justify-between items-center py-3 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${x[0]}</span>
            <span class="text-[10px] ${colorClass}">${fmtJuta(x[1])}</span>
        </div>`).join('');
}

function renderOverdueTop(data) {
    const el = document.getElementById('list-overdue');
    if (!el) return;
    el.innerHTML = data.slice(0,5).map((d,i) => `
        <div class="flex justify-between py-2 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${d.customer_name}</span>
            <span class="text-[10px] text-red-500">${fmtJuta(d.total_overdue)}</span>
        </div>`).join('');
}


// ================= FUNGSI UTAMA BARU UNTUK MENGENDALIKAN HALAMAN PER TAB =================
function renderKontenPerTab(data) {
    // Cari atau buat wadah dinamis jika Anda menaruh judul "DETAIL KONTRIBUSI LEASING" dalam teks kosong
    const mainContainer = document.querySelector('.bg-white.p-6.rounded-2xl, main, #main-content-area') || document.body;

    if (currentTab === 'LEASING') {
        // Filter data khusus leasing (Bukan CASH)
        const leasingData = data.filter(d => {
            const l = (d.leasing_name || 'CASH').toUpperCase().trim();
            return !["CASH", "CASH TERIMA", ""].includes(l);
        });

        // Tampilkan data ke dalam kontainer berupa tabel khusus Leasing
        let htmlLeasing = `
            <div class="p-4">
                <h3 class="text-sm font-bold text-slate-700 uppercase mb-4">DETAIL KONTRIBUSI LEASING</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="border-b border-slate-100 text-slate-400 font-bold bg-slate-50">
                                <th class="p-3">NO</th>
                                <th class="p-3">CUSTOMER NAME</th>
                                <th class="p-3">LEASING</th>
                                <th class="p-3 text-right">O/S BALANCE</th>
                                <th class="p-3">PLAN BAYAR (CABANG)</th>
                                <th class="p-3">KETERANGAN LEASING</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${leasingData.map((d, i) => `
                                <tr class="border-b border-slate-50 hover:bg-slate-50 font-bold uppercase">
                                    <td class="p-3 text-slate-400">${i+1}</td>
                                    <td class="p-3">
                                        <p class="text-slate-800">${d.customer_name}</p>
                                        <p class="text-[9px] text-slate-400 font-normal">SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
                                    </td>
                                    <td class="p-3 text-slate-600">${d.leasing_name}</td>
                                    <td class="p-3 text-right text-blue-600">${fmtIDR(d.os_balance)}</td>
                                    <td class="p-3"><input type="text" class="border p-1 rounded text-[10px]" value="${d.plan_bayar || ''}" placeholder="Tgl Rencana..."></td>
                                    <td class="p-3"><input type="text" class="border p-1 rounded text-[10px]" value="${d.keterangan_leasing || ''}" placeholder="Keterangan..."></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        
        // Cari elemen box putih kosong Anda dan isi kodenya di sana
        updateHalamanKonten(htmlLeasing);

    } else if (currentTab === 'OVERDUE') {
        // Filter data yang memiliki keterlambatan (overdue > 0)
        const overdueData = data.filter(d => Number(d.total_overdue || 0) > 0);

        let htmlOverdue = `
            <div class="p-4">
                <h3 class="text-sm font-bold text-red-600 uppercase mb-4">DETAIL DATA OVERDUE (LEWAT TOP)</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="border-b border-slate-100 text-slate-400 font-bold bg-slate-50">
                                <th class="p-3">NO</th>
                                <th class="p-3">CUSTOMER NAME</th>
                                <th class="p-3">LEASING</th>
                                <th class="p-3 text-right">TOTAL OVERDUE</th>
                                <th class="p-3 text-right">O/S BALANCE</th>
                                <th class="p-3">KETERANGAN LEASING</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${overdueData.map((d, i) => `
                                <tr class="border-b border-slate-50 hover:bg-slate-50 font-bold uppercase">
                                    <td class="p-3 text-slate-400">${i+1}</td>
                                    <td class="p-3">
                                        <p class="text-slate-800">${d.customer_name}</p>
                                        <p class="text-[9px] text-slate-400 font-normal">SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
                                    </td>
                                    <td class="p-3 text-slate-600">${d.leasing_name || 'CASH'}</td>
                                    <td class="p-3 text-right text-red-500">${fmtIDR(d.total_overdue)}</td>
                                    <td class="p-3 text-right text-blue-600">${fmtIDR(d.os_balance)}</td>
                                    <td class="p-3"><input type="text" class="border p-1 rounded text-[10px]" value="${d.keterangan_leasing || ''}" placeholder="Keterangan..."></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        
        updateHalamanKonten(htmlOverdue);

    } else if (currentTab === 'DATABASE LENGKAP') {
        // Tampilkan seluruh data tanpa terkecuali
        if (document.getElementById('tab-database-body')) {
            renderTabDatabaseBiasa(data);
        } else {
            // Jika struktur tabel hilang saat pindah halaman, bangun ulang kerangka tabelnya secara dinamis
            let htmlFullDB = `
                <div class="p-4">
                    <h3 class="text-sm font-bold text-slate-700 uppercase mb-4">DATABASE LENGKAP AR UNIT</h3>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr class="border-b border-slate-100 text-slate-400 font-bold bg-slate-50">
                                    <th class="p-4">NO</th>
                                    <th class="p-4">CUSTOMER NAME</th>
                                    <th class="p-4">LEASING</th>
                                    <th class="p-4 text-right">O/S BALANCE</th>
                                    <th class="p-4">PLAN BAYAR (CABANG)</th>
                                    <th class="p-4">KETERANGAN LEASING</th>
                                    <th class="p-4 text-center">AKSI</th>
                                </tr>
                            </thead>
                            <tbody id="tab-database-body"></tbody>
                        </table>
                    </div>
                </div>`;
            updateHalamanKonten(htmlFullDB);
            renderTabDatabaseBiasa(data);
        }
    }
}

// Fungsi pembantu untuk menginjeksi isi HTML ke halaman putih kosong Anda agar dinamis
function updateHalamanKonten(htmlString) {
    // Kode mencari box putih besar yang ada pada gambar Anda (berdasarkan teks "DETAIL KONTRIBUSI LEASING")
    const semuaBoxPutih = document.querySelectorAll('.bg-white, .rounded-xl, .rounded-2xl');
    let targetBox = null;

    semuaBoxPutih.forEach(box => {
        if (box.innerText.includes('DETAIL KONTRIBUSI LEASING') || box.innerText.includes('DETAIL DATA OVERDUE') || box.id === 'konten-aktif-tab') {
            targetBox = box;
        }
    });

    if (targetBox) {
        targetBox.id = "konten-aktif-tab"; // Tandai ID agar mudah ditemukan nanti
        targetBox.innerHTML = htmlString;
    }
}

function renderTabDatabaseBiasa(data) {
    const tbody = document.getElementById('tab-database-body');
    if (!tbody) return;
    tbody.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="p-4 text-slate-400 font-bold">${i+1}</td>
            <td class="p-4">
                <p class="font-bold uppercase">${d.customer_name}</p>
                <p class="text-[8px] text-slate-400">SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
            </td>
            <td class="p-4 uppercase font-bold text-slate-600">${d.leasing_name || 'CASH'}</td>
            <td class="p-4 text-right font-black text-blue-600">${fmtIDR(d.os_balance)}</td>
            <td class="p-4"><input type="text" class="input-custom text-[10px]" placeholder="Tgl Rencana..." value="${d.plan_bayar || ''}"></td>
            <td class="p-4"><input type="text" class="input-custom text-[10px]" placeholder="Keterangan..." value="${d.keterangan_leasing || ''}"></td>
            <td class="p-4 text-center"><button class="bg-slate-100 hover:bg-emerald-500 hover:text-white p-2 rounded-lg transition-all">💾</button></td>
        </tr>`).join('');
}

// LOGIKA PASANG EVENT DETEKSI KLIK TOMBOL TAB
document.addEventListener('click', function(e) {
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'DIV' || e.target.tagName === 'SPAN')) {
        const txt = e.target.innerText.toUpperCase().trim();
        if (['RINGKASAN', 'LEASING', 'OVERDUE', 'DATABASE LENGKAP'].includes(txt)) {
            currentTab = txt;
            
            // Atur style tombol aktif (Biar berubah warna gelap saat diklik)
            const parent = e.target.parentElement;
            if (parent) {
                Array.from(parent.children).forEach(btn => {
                    btn.classList.remove('bg-blue-950', 'text-white', 'bg-slate-800');
                    btn.classList.add('bg-white', 'text-slate-600'); // Kembalikan ke warna dasar abu-abu/putih
                });
            }
            
            // Berikan kelas aktif gelap ke tombol terpilih
            e.target.className = "px-4 py-2 text-xs font-bold rounded-lg transition-all bg-blue-950 text-white"; 

            // Update isi halaman data di bawah secara real-time tanpa reload Supabase
            renderKontenPerTab(globalMasterData);
        }
    }
});

document.addEventListener('DOMContentLoaded', fetchData);