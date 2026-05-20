import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emFibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let cachedData = []; 

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

// FUNGSI SECURITY AMAN HURUF BESAR KECIL DATABASE
function getProp(obj, key) {
    if (!obj) return undefined;
    if (obj[key.toLowerCase()] !== undefined) return obj[key.toLowerCase()];
    if (obj[key.toUpperCase()] !== undefined) return obj[key.toUpperCase()];
    if (obj[key] !== undefined) return obj[key];
    const lowerKey = key.toLowerCase();
    for (let k in obj) {
        if (k.toLowerCase() === lowerKey) return obj[k];
    }
    return undefined;
}

// 1. FUNGSI AMBIL DATA DARI SUPABASE
async function fetchData() {
    try {
        console.log("Memulai penarikan data dari Supabase...");
        let query = supabase.from('ar_unit').select('*');
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
            console.log("Data berhasil ditarik! Jumlah baris:", data.length);
            
            if (data.length === 0) {
                if (document.getElementById('status-update')) {
                    document.getElementById('status-update').innerText = "KONEKSI SUKSES, TAPI TABEL KOSONG!";
                }
                return;
            }

            cachedData = data; 
            
            // Dibungkus try-catch agar jika UI gagal, data di memori tidak rusak
            try {
                updateDashboard(data);
            } catch (uiError) {
                console.error("Gagal memperbarui UI Dashboard, tapi data aman:", uiError);
            }
            
            if (document.getElementById('status-update')) {
                document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
            }
            if (document.getElementById('tgl-arsip')) {
                document.getElementById('tgl-arsip').innerText = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
            }
        }
    } catch (e) {
        console.error("Koneksi Supabase Gagal Total:", e);
        if (document.getElementById('status-update')) {
            document.getElementById('status-update').innerText = `GAGAL AMBIL DATA: ${e.message}`;
        }
    }
}

// 2. FUNGSI UPDATE UI DASHBOARD
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeasList = {}, mSales = {}, mSpv = {}, mOverdueTop = [];

    data.forEach(d => {
        const os = Number(getProp(d, 'os_balance') || 0);
        const ov = Number(getProp(d, 'total_overdue') || 0);
        const l = String(getProp(d, 'leasing_name') || 'CASH').toUpperCase().trim();
        const penalti = Number(getProp(d, 'penalty_amount') || 0);
        const lancarNominal = Number(getProp(d, 'lancar') || 0);
        
        s.os += os; 
        s.ov += ov; 
        s.pen += penalti; 
        s.lan += lancarNominal;
        
        if (ov > 0) { s.countOv++; mOverdueTop.push(d); }
        if (penalti > 0) s.cPen++;

        aging['LANCAR'] += lancarNominal / 1000000;
        aging['1-30 H'] += Number(getProp(d, 'hari_1_30') || 0) / 1000000;
        aging['31-60 H'] += Number(getProp(d, 'hari_31_60') || 0) / 1000000;
        aging['>60 H'] += Number(getProp(d, 'lebih_60_hari') || 0) / 1000000;

        if (["CASH", "CASH TERIMA", ""].includes(l)) { 
            s.cash += os; s.cCash++; 
        } else { 
            s.leas += os; s.cLeas++; 
            mLeasList[l] = (mLeasList[l] || 0) + os; 
            if (l.includes('TAFS') || l.includes('ACC')) {
                tvc.total++;
                if (String(getProp(d, 'status_tagih')).toUpperCase() === 'SUDAH GI') tvc.gi++;
                else tvc.deliv++;
            }
        }

        const rawSales = String(getProp(d, 'salesman_name') || "").trim();
        const rawSpv = String(getProp(d, 'supervisor_name') || "").trim();
        const finalSales = rawSales !== "" ? rawSales : (rawSpv !== "" ? rawSpv : "OFFICE");
        const finalSpv = rawSpv !== "" ? rawSpv : "OFFICE";

        mSales[finalSales] = (mSales[finalSales] || 0) + os;
        mSpv[finalSpv] = (mSpv[finalSpv] || 0) + os;
    });

    // MASUKKAN ANGKA KE TEXT HTML (Aman & Terisolasi)
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    if(document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    if(document.getElementById('badge-overdue')) document.getElementById('badge-overdue').innerText = `${s.countOv} SPK LEWAT TOP`;
    if(document.getElementById('spk-penalty')) document.getElementById('spk-penalty').innerText = `${s.cPen} SPK`;
    
    if(s.os > 0) {
        if(document.getElementById('bar-cash')) document.getElementById('bar-cash').style.width = `${(s.cash/s.os)*100}%`;
        if(document.getElementById('bar-leasing')) document.getElementById('bar-leasing').style.width = `${(s.leas/s.os)*100}%`;
    }
    
    if(document.getElementById('val-total-cash')) document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    if(document.getElementById('unit-total-cash')) document.getElementById('unit-total-cash').innerText = `${s.cCash} Unit`;
    if(document.getElementById('val-total-leas')) document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    if(document.getElementById('unit-total-leas')) document.getElementById('unit-total-leas').innerText = `${s.cLeas} Unit`;

    if(document.getElementById('total-unit-tvc')) document.getElementById('total-unit-tvc').innerText = `${tvc.total} Unit`;
    if(document.getElementById('unit-gi-tvc')) document.getElementById('unit-gi-tvc').innerText = `${tvc.gi} Unit`;
    if(document.getElementById('unit-delivery-tvc')) document.getElementById('unit-delivery-tvc').innerText = `${tvc.deliv} Unit`;

    // PROSES GRAFIK DENGAN PROTEKSI AMAN (Biar tidak saling menggagalkan)
    try { renderDonutCashLeasing(s.cash, s.leas); } catch(e) { console.error("Gagal load Donut:", e); }
    try { renderAgingChart(aging); } catch(e) { console.error("Gagal load Aging Chart:", e); }
    
    // PROSES DATA LIST & TABEL
    try {
        renderLeasingList(mLeasList, s.os);
        renderTopList(mSales, 'list-sales', 'text-blue-600');
        renderTopList(mSpv, 'list-spv', 'text-purple-600');
        renderOverdueTop(mOverdueTop);
        renderTabLeasingFull(data);
        renderTabOverdueFull(data);
        renderDataArUnitFull(data); 
        renderTabDatabaseFull(data);
    } catch(tableError) {
        console.error("Ada error di pengisian list/tabel:", tableError);
    }
}

// 3. FUNGSI RENDER DIAGRAM BATANG (AGING) - BEBAS KOTAK WARNA LEGENDA
function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging");
    if (!el) return;
    const options = {
        series: [{ name: 'Juta', data: Object.values(agingData).map(v => Math.round(v)) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: (v) => v + " Jt", style: { fontSize: '9px', fontWeight: 800 }, offsetY: -20 },
        legend: { show: false }, // Menghapus kotak warna legenda di samping
        xaxis: { 
            categories: Object.keys(agingData), 
            labels: { show: true, style: { fontSize: '9px', fontWeight: 700 } } // Teks persis di bawah batang
        },
        yaxis: { show: false },
        grid: { show: false }
    };
    if (charts.bar && typeof charts.bar.updateOptions === 'function') {
        charts.bar.updateOptions(options);
    } else {
        charts.bar = new ApexCharts(el, options); charts.bar.render();
    }
}

// 4. FUNGSI RENDER DIAGRAM DONUT (CASH VS LEASING - 2 WARNA)
function renderDonutCashLeasing(totalCash, totalLeasing) {
    const el = document.querySelector("#chart-donut-leasing");
    if (!el) return;
    
    // Fallback jika datanya benar-benar masih kosong di awal agar chart tidak error
    const seriesData = (totalCash === 0 && totalLeasing === 0) ? [1, 1] : [totalCash, totalLeasing];

    const options = {
        series: seriesData,
        labels: ['TOTAL CASH', 'TOTAL LEASING'],
        chart: { type: 'donut', height: 180 },
        legend: { show: false },
        dataLabels: { enabled: false },
        colors: ['#10B981', '#3B82F6'] 
    };
    if (charts.donut && typeof charts.donut.updateOptions === 'function') {
        charts.donut.updateOptions(options);
    } else {
        charts.donut = new ApexCharts(el, options); charts.donut.render();
    }
}

// --- SISA FUNGSI RENDER LIST DAN TABEL TETAP AMAN ---
function renderLeasingList(map, total) {
    const el = document.getElementById('leasing-list'); if (!el) return;
    if (Object.keys(map).length === 0) { el.innerHTML = '<p class="text-[10px] text-slate-400">Tidak ada data leasing</p>'; return; }
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n, v]) => `
        <div class="mb-3">
            <div class="flex justify-between text-[9px] font-bold mb-1 uppercase"><span>${n}</span><span>${total > 0 ? ((v/total)*100).toFixed(1) : 0}%</span></div>
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div class="bg-blue-600 h-full" style="width: ${total > 0 ? (v/total)*100 : 0}%"></div></div>
        </div>`).join('');
}

function renderTopList(map, id, colorClass) {
    const el = document.getElementById(id); if (!el) return;
    if (Object.keys(map).length === 0) { el.innerHTML = '<p class="text-[10px] text-slate-400 text-center py-2">Tidak ada data</p>'; return; }
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map((x,i) => `
        <div class="flex justify-between items-center py-3 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${x[0]}</span>
            <span class="text-[10px] ${colorClass}">${fmtJuta(x[1])}</span>
        </div>`).join('');
}

function renderOverdueTop(data) {
    const el = document.getElementById('list-overdue'); if (!el) return;
    if (data.length === 0) { el.innerHTML = '<p class="text-[10px] text-slate-400 text-center py-2">Tidak ada data overdue</p>'; return; }
    el.innerHTML = data.slice(0,5).map((d,i) => `
        <div class="flex justify-between py-2 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${getProp(d, 'customer_name') || '-'}</span>
            <span class="text-[10px] text-red-500">${fmtJuta(getProp(d, 'total_overdue'))}</span>
        </div>`).join('');
}

function renderTabLeasingFull(data) {
    const el = document.getElementById('tab-leasing-full-list'); if (!el) return;
    const leasingData = data.filter(d => {
        const l = String(getProp(d, 'leasing_name') || 'CASH').toUpperCase().trim();
        return !["CASH", "CASH TERIMA", ""].includes(l);
    });
    if(leasingData.length === 0) { el.innerHTML = '<p class="text-xs text-center py-4 text-slate-400">Tidak ada data kontribusi leasing</p>'; return; }
    el.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[10px]">
                <thead>
                    <tr class="border-b border-slate-100 text-slate-400 font-bold bg-slate-50 uppercase">
                        <th class="p-3 w-12 text-center">No</th>
                        <th class="p-3">Nama Customer / Sales</th>
                        <th class="p-3">Nama Leasing</th>
                        <th class="p-3 text-right pr-6">O/S Balance</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                    ${leasingData.map((d, i) => `
                        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase">
                            <td class="p-3 text-center text-slate-400">${i+1}</td>
                            <td class="p-3">
                                <p class="text-slate-800 text-[11px] font-black">${getProp(d, 'customer_name') || '-'}</p>
                                <p class="text-[8px] text-slate-400 mt-0.5">👤 SALES: ${getProp(d, 'salesman_name') || getProp(d, 'supervisor_name') || 'OFFICE'}</p>
                            </td>
                            <td class="p-3">
                                <span class="bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-[9px] font-extrabold tracking-wide">${getProp(d, 'leasing_name') || '-'}</span>
                            </td>
                            <td class="p-3 text-right pr-6 text-blue-600 text-[11px] font-black">${fmtIDR(getProp(d, 'os_balance'))}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

function renderTabOverdueFull(data) {
    const el = document.getElementById('tab-overdue-full-list'); if (!el) return;
    const overdueData = data.filter(d => Number(getProp(d, 'total_overdue') || 0) > 0);
    if(overdueData.length === 0) { el.innerHTML = '<p class="text-xs text-center py-4 text-slate-400">Semua tagihan lunas / tidak ada overdue</p>'; return; }
    el.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[10px]">
                <thead>
                    <tr class="border-b border-slate-100 text-slate-400 font-bold bg-slate-50 uppercase">
                        <th class="p-3 w-12 text-center">No</th>
                        <th class="p-3">Nama Customer</th>
                        <th class="p-3">Leasing</th>
                        <th class="p-3 text-right text-red-500 bg-red-50/50">Total Overdue</th>
                        <th class="p-3 text-right pr-6">O/S Balance</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                    ${overdueData.map((d, i) => `
                        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase">
                            <td class="p-3 text-center text-slate-400">${i+1}</td>
                            <td class="p-3">
                                <p class="text-slate-800 text-[11px] font-black">${getProp(d, 'customer_name') || '-'}</p>
                                <p class="text-[8px] text-slate-400 mt-0.5">👤 SALES: ${getProp(d, 'salesman_name') || getProp(d, 'supervisor_name') || 'OFFICE'}</p>
                            </td>
                            <td class="p-3">
                                <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">${getProp(d, 'leasing_name') || 'CASH'}</span>
                            </td>
                            <td class="p-3 text-right font-black text-red-600 bg-red-50/20">${fmtIDR(getProp(d, 'total_overdue'))}</td>
                            <td class="p-3 text-right pr-6 text-blue-600 text-[11px] font-bold">${fmtIDR(getProp(d, 'os_balance'))}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

function renderDataArUnitFull(data) {
    const el = document.getElementById('tab-ar-unit-body'); if (!el) return;
    const filterAR = data.filter(d => {
        const l = String(getProp(d, 'leasing_name') || '').toUpperCase().trim();
        return l.includes('TAFS') || l.includes('ACC');
    });
    if(filterAR.length === 0) { el.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-400 font-bold">Tidak ada unit dengan Leasing TAFS / ACC</td></tr>'; return; }

    el.innerHTML = filterAR.map((d, i) => {
        const idUtama = getProp(d, 'No') || getProp(d, 'id') || i;
        return `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4 text-slate-800 font-black">${getProp(d, 'customer_name') || '-'}</td>
            <td class="p-4">
                <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded text-[9px] font-extrabold tracking-wide">${getProp(d, 'leasing_name') || '-'}</span>
                <p class="text-[7px] text-slate-300 mt-1">SPK: ${getProp(d, 'no_spk') || '-'}</p>
            </td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(getProp(d, 'os_balance'))}</td>
            <td class="p-4 w-48"><input type="text" id="cabang-${idUtama}" value="${getProp(d, 'ket_cabang') || ''}" placeholder="Ket cabang..." class="input-custom bg-white"></td>
            <td class="p-4 w-48"><input type="text" id="plan-${idUtama}" value="${getProp(d, 'plan_bayar_leasing') || ''}" placeholder="Isi plan..." class="input-custom bg-white"></td>
            <td class="p-4 w-48"><input type="text" id="ket-${idUtama}" value="${getProp(d, 'ket_leasing') || ''}" placeholder="Isi keterangan..." class="input-custom bg-white"></td>
            <td class="p-4 text-center w-16"><button onclick="simpanCatatan('${idUtama}')" class="text-blue-600 hover:bg-blue-600 hover:text-white bg-blue-50 p-2 rounded-lg transition-all">💾</button></td>
        </tr>`;
    }).join('');
}

function renderTabDatabaseFull(data) {
    const el = document.getElementById('tab-database-body'); if (!el) return;
    el.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4 text-slate-800 font-black">${getProp(d, 'customer_name') || '-'}</td>
            <td class="p-4"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">${getProp(d, 'leasing_name') || 'CASH'}</span></td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(getProp(d, 'os_balance'))}</td>
            <td class="p-4 text-right text-emerald-600">${fmtIDR(getProp(d, 'hari_1_30') || getProp(d, 'lancar'))}</td>
            <td class="p-4 text-right text-amber-500">${fmtIDR(getProp(d, 'hari_31_60'))}</td>
            <td class="p-4 text-right text-orange-500">${fmtIDR(getProp(d, 'lebih_60_hari'))}</td>
            <td class="p-4 text-right text-red-600 font-black bg-red-50/30">${fmtIDR(getProp(d, 'total_overdue'))}</td>
        </tr>`).join('');
}

// 5. FUNGSI SIMPAN CATATAN KE SUPABASE
window.simpanCatatan = async function(noId) {
    try {
        const valCabang = document.getElementById(`cabang-${noId}`).value;
        const valPlan = document.getElementById(`plan-${noId}`).value;
        const valKet = document.getElementById(`ket-${noId}`).value;
        let targetKey = cachedData.length > 0 && cachedData[0]['id'] !== undefined ? 'id' : 'No';

        const { error } = await supabase.from('ar_unit').update({
            ket_cabang: valCabang, plan_bayar_leasing: valPlan, ket_leasing: valKet
        }).eq(targetKey, noId);

        if (error) throw error;
        alert("Catatan penagihan unit berhasil disimpan! 👍");
        fetchData(); 
    } catch (err) {
        alert("Gagal menyimpan data: " + err.message);
    }
}

// 6. FUNGSI DOWNLOAD EXCEL
function downloadExcel() {
    if (!cachedData || cachedData.length === 0) {
        alert("Data belum siap. Silakan tunggu sebentar."); return;
    }
    try {
        const dataUntukExcel = cachedData.map((d, index) => ({
            "No": index + 1,
            "Nama Customer": getProp(d, 'customer_name') || "-",
            "No SPK": getProp(d, 'no_spk') || "-",
            "Leasing": getProp(d, 'leasing_name') || "CASH",
            "O/S Balance": getProp(d, 'os_balance') || 0,
            "Hari 1-30 (Lancar)": getProp(d, 'hari_1_30') || getProp(d, 'lancar') || 0,
            "Hari 31-60": getProp(d, 'hari_31_60') || 0,
            "Lebih 60 Hari": getProp(d, 'lebih_60_hari') || 0,
            "Total Overdue": getProp(d, 'total_overdue') || 0,
            "Salesman": getProp(d, 'salesman_name') || "-",
            "Supervisor": getProp(d, 'supervisor_name') || "-"
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataUntukExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data AR Unit");
        XLSX.writeFile(workbook, `Report_AR_Unit_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
        alert("Terjadi masalah saat memproses Excel: " + error.message);
    }
}

// 7. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    const btnDownload = document.getElementById('btn-download-excel');
    if (btnDownload) btnDownload.addEventListener('click', downloadExcel);
});