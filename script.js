import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let currentTab = 'DATABASE LENGKAP'; // Default tab state sesuai gambar pertama Anda
let globalMasterData = [];          // Menyimpan cadangan data asli dari Supabase

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

    // Validasi elemen sebelum diisi menghindari error jika template HTML berganti view
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
    
    // Alirkan data ke sistem manajemen Tab Aktif
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

// ================= LOGIKA UTAMA MANAJEMEN TAB KONTEN =================
function renderKontenPerTab(data) {
    if (currentTab === 'LEASING') {
        // Menyaring data khusus non-CASH
        const leasingData = data.filter(d => {
            const l = (d.leasing_name || 'CASH').toUpperCase().trim();
            return !["CASH", "CASH TERIMA", ""].includes(l);
        });

        // DESAIN BARU TAB LEASING: Bersih, Tanpa Plan Bayar & Keterangan, Tampilan Indah
        let htmlLeasing = `
            <div class="p-2">
                <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                    <h3 class="text-xs font-black text-slate-700 tracking-wider uppercase">📊 DETAIL KONTRIBUSI LEASING</h3>
                    <span class="bg-blue-50 text-blue-600 text-[10px] font-bold px-3 py-1 rounded-full">${leasingData.length} UNIT LEASING</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/50">
                                <th class="p-4 w-12 text-center">NO</th>
                                <th class="p-4">CUSTOMER & SALES INFO</th>
                                <th class="p-4">NAMA LEASING</th>
                                <th class="p-4 text-right pr-6">O/S BALANCE</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${leasingData.map((d, i) => `
                                <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-all font-bold uppercase">
                                    <td class="p-4 text-center text-slate-400 font-medium">${i+1}</td>
                                    <td class="p-4">
                                        <p class="text-slate-800 text-[11px] font-black">${d.customer_name}</p>
                                        <p class="text-[9px] text-slate-400 font-semibold mt-0.5">👤 SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
                                    </td>
                                    <td class="p-4">
                                        <span class="bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide">${d.leasing_name}</span>
                                    </td>
                                    <td class="p-4 text-right pr-6 text-blue-600 text-[12px] font-black">${fmtIDR(d.os_balance)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        
        updateBoxKontenSecaraDinamis(htmlLeasing);

    } else if (currentTab === 'OVERDUE') {
        // Menyaring data yang memiliki nilai overdue > 0
        const overdueData = data.filter(d => Number(d.total_overdue || 0) > 0);

        // DESAIN TAB OVERDUE: Menampilkan tabel data penunggakan dengan rapi
        let htmlOverdue = `
            <div class="p-2">
                <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                    <h3 class="text-xs font-black text-red-600 tracking-wider uppercase">🚨 SEMUA DATA OVERDUE UNIT</h3>
                    <span class="bg-red-50 text-red-600 text-[10px] font-bold px-3 py-1 rounded-full">${overdueData.length} CUSTOMER OVERDUE</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/50">
                                <th class="p-4 w-12 text-center">NO</th>
                                <th class="p-4">CUSTOMER NAME</th>
                                <th class="p-4">LEASING</th>
                                <th class="p-4 text-right text-red-500 bg-red-50/30">TOTAL OVERDUE</th>
                                <th class="p-4 text-right pr-6">O/S BALANCE</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${overdueData.map((d, i) => `
                                <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-all font-bold uppercase">
                                    <td class="p-4 text-center text-slate-400 font-medium">${i+1}</td>
                                    <td class="p-4">
                                        <p class="text-slate-800 text-[11px] font-black">${d.customer_name}</p>
                                        <p class="text-[9px] text-slate-400 font-semibold mt-0.5">👤 SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
                                    </td>
                                    <td class="p-4">
                                        <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px]">${d.leasing_name || 'CASH'}</span>
                                    </td>
                                    <td class="p-4 text-right font-black text-red-600 bg-red-50/20">${fmtIDR(d.total_overdue)}</td>
                                    <td class="p-4 text-right pr-6 text-blue-600 text-[11px] font-bold">${fmtIDR(d.os_balance)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        
        updateBoxKontenSecaraDinamis(htmlOverdue);

    } else if (currentTab === 'DATABASE LENGKAP') {
        // Tampilan bawaan utama Database Lengkap Anda
        if (document.getElementById('tab-database-body')) {
            renderTabDatabaseBiasa(data);
        } else {
            let htmlFullDB = `
                <div class="p-2">
                    <h3 class="text-xs font-black text-slate-700 tracking-wider uppercase mb-4">📝 DATABASE LENGKAP AR UNIT</h3>
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
            updateBoxKontenSecaraDinamis(htmlFullDB);
            renderTabDatabaseBiasa(data);
        }
    }
}

// Menangani render komponen html ke dalam box putih kontainer utama secara dinamis
function updateBoxKontenSecaraDinamis(htmlString) {
    const boxes = document.querySelectorAll('.bg-white, .rounded-xl, .rounded-2xl');
    let targetBox = null;

    boxes.forEach(box => {
        const txt = box.innerText.toUpperCase();
        if (txt.includes('DETAIL KONTRIBUSI LEASING') || txt.includes('SEMUA DATA OVERDUE UNIT') || txt.includes('DATABASE LENGKAP') || box.id === 'box-konten-tab-aktif') {
            targetBox = box;
        }
    });

    if (targetBox) {
        targetBox.id = "box-konten-tab-aktif";
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

// LOGIKA DETEKSI DAN AKTIVASI EVENT KLIK PADA TOMBOL TAB NAVIGATION
document.addEventListener('click', function(e) {
    if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'DIV' || e.target.tagName === 'SPAN')) {
        const txt = e.target.innerText.toUpperCase().trim();
        if (['RINGKASAN', 'LEASING', 'OVERDUE', 'DATABASE LENGKAP'].includes(txt)) {
            currentTab = txt;
            
            // Logika pengelolaan CSS tombol aktif (Menyesuaikan template gelap/terang Anda)
            const parent = e.target.parentElement;
            if (parent) {
                Array.from(parent.children).forEach(btn => {
                    btn.className = "px-4 py-2 text-xs font-bold rounded-lg transition-all bg-white text-slate-600 border border-slate-100";
                });
            }
            
            // Memberikan style biru tua tegas pada tab yang saat ini sedang aktif
            e.target.className = "px-4 py-2 text-xs font-bold rounded-lg transition-all bg-blue-950 text-white shadow-sm"; 

            // Eksekusi render data sesuai tab tanpa memuat ulang API Supabase
            renderKontenPerTab(globalMasterData);
        }
    }
});

// ================= KODE TAMBAHAN RECOVERY RENDER TAB LEASING =================
document.addEventListener('click', function(e) {
    if (e.target && ['LEASING', 'OVERDUE', 'DATABASE LENGKAP'].includes(e.target.innerText.toUpperCase().trim())) {
        // Memberikan jeda 50ms untuk memastikan DOM awal selesai dimuat oleh script utama
        setTimeout(() => {
            const activeBox = document.getElementById('box-konten-tab-aktif');
            
            // Jika box aktif ditemukan namun isinya masih kosong/hanya judul template (seperti gambar 3)
            if (activeBox && (activeBox.children.length === 0 || activeBox.innerText.trim() === "DETAIL KONTRIBUSI LEASING")) {
                
                // Ambil data leasing non-CASH dari globalMasterData
                const leasingData = globalMasterData.filter(d => {
                    const l = (d.leasing_name || 'CASH').toUpperCase().trim();
                    return !["CASH", "CASH TERIMA", ""].includes(l);
                });

                // Generate ulang HTML secara presisi ke dalam box kontainer
                activeBox.innerHTML = `
                    <div class="p-2">
                        <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                            <h3 class="text-xs font-black text-slate-700 tracking-wider uppercase">📊 DETAIL KONTRIBUSI LEASING</h3>
                            <span class="bg-blue-50 text-blue-600 text-[10px] font-bold px-3 py-1 rounded-full">${leasingData.length} UNIT LEASING</span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr class="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/50">
                                        <th class="p-4 w-12 text-center">NO</th>
                                        <th class="p-4">CUSTOMER & SALES INFO</th>
                                        <th class="p-4">NAMA LEASING</th>
                                        <th class="p-4 text-right pr-6">O/S BALANCE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${leasingData.map((d, i) => `
                                        <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-all font-bold uppercase">
                                            <td class="p-4 text-center text-slate-400 font-medium">${i+1}</td>
                                            <td class="p-4">
                                                <p class="text-slate-800 text-[11px] font-black">${d.customer_name}</p>
                                                <p class="text-[9px] text-slate-400 font-semibold mt-0.5">👤 SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
                                            </td>
                                            <td class="p-4">
                                                <span class="bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide">${d.leasing_name}</span>
                                            </td>
                                            <td class="p-4 text-right pr-6 text-blue-600 text-[12px] font-black">${fmtIDR(d.os_balance)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>`;
            }
        }, 50);
    }
});

document.addEventListener('DOMContentLoaded', fetchData);
