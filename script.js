import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let cachedData = []; 

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " JT";

// Fungsi ekstraksi properti data yang aman (kebal huruf besar/kecil)
function getNum(obj, keys) {
    for (let key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) {
            return Number(obj[key]);
        }
    }
    return 0;
}

function getStr(obj, keys) {
    for (let key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) {
            return String(obj[key]).trim();
        }
    }
    return '';
}

// 1. FUNGSI AMBIL DATA DARI SUPABASE
async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        
        if (data) {
            console.log("DATA BERHASIL DI-FETCH:", data);
            cachedData = data; 
            updateDashboard(data);
            
            if (document.getElementById('status-update')) {
                document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
                document.getElementById('status-update').className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
            }
            if (document.getElementById('tgl-arsip')) {
                document.getElementById('tgl-arsip').innerText = "22 MEI 2026";
            }
        }
    } catch (e) {
        console.error("Error Fetching Data:", e);
        if (document.getElementById('status-update')) {
            document.getElementById('status-update').innerText = `KONEKSI GAGAL: ${e.message}`;
            document.getElementById('status-update').className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
        }
    }
}

// 2. FUNGSI UTAMA UPDATE UI DASHBOARD
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, countPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {}, mOverdueTop = [];

    data.forEach(d => {
        // Pemetaan nama kolom sesuai struktur tabel Supabase Anda
        const os = getNum(d, ['os_balance', 'osbalance', 'OS_Balance']);
        const ov = getNum(d, ['total_overdue', 'overdue', 'Total_Overdue']);
        const lancarNominal = getNum(d, ['lancar', 'Lancar', 'hari_1_30']);
        const h3160 = getNum(d, ['hari_31_60', 'h_31_60']);
        const h60 = getNum(d, ['lebih_60_hari', 'lebih_60']);
        const penalti = getNum(d, ['penalty_amount', 'penalty', 'potensi_penalti']);
        
        const l = getStr(d, ['leasing_name', 'leasing', 'Leasing']).toUpperCase();
        const statusTagih = getStr(d, ['status_tagih', 'status']).toUpperCase();
        const salesName = getStr(d, ['salesman_name', 'salesman', 'Salesman']);
        const spvName = getStr(d, ['supervisor_name', 'supervisor', 'Supervisor']);

        s.os += os;
        s.ov += ov;
        s.pen += penalti;
        s.lan += lancarNominal;

        if (ov > 0) s.countOv++;
        if (penalti > 0) s.countPen++;

        // Distribusi chart bar aging
        aging['LANCAR'] += lancarNominal;
        aging['1-30 H'] += lancarNominal; 
        aging['31-60 H'] += h3160;
        aging['>60 H'] += h60;

        // Distribusi metode pembayaran (Cash vs Leasing)
        if (["CASH", "CASH TERIMA", "", "0"].includes(l)) {
            s.cash += os;
            s.cCash++;
        } else {
            s.leas += os;
            s.cLeas++;
            mLeas[l] = (mLeas[l] || 0) + os;

            if (l.includes('TAFS') || l.includes('ACC')) {
                tvc.total++;
                if (statusTagih === 'SUDAH GI' || statusTagih === 'GI') tvc.gi++;
                else tvc.deliv++;
            }
        }

        // Pengelompokan data untuk komponen peringkat (Top List)
        const fSales = salesName !== "" ? salesName : "OFFICE";
        const fSpv = spvName !== "" ? spvName : "OFFICE";
        mSales[fSales] = (mSales[fSales] || 0) + os;
        mSpv[fSpv] = (mSpv[fSpv] || 0) + os;
    });

    // Menghitung Sisa Belum Jatuh Tempo
    const belumJatuhTempo = s.os - s.ov;

    // RENDER METRIK UTAMA KE KARTU RINGKASAN
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.pen); // Ditampilkan sebagai Potensi Penalti
    if(document.getElementById('belum-jatuh-tempo')) document.getElementById('belum-jatuh-tempo').innerText = fmtIDR(belumJatuhTempo);
    
    if(document.getElementById('badge-overdue')) document.getElementById('badge-overdue').innerText = `${s.countOv} SPK LEWAT TOP`;
    if(document.getElementById('spk-penalty')) document.getElementById('spk-penalty').innerText = `${s.countPen} SPK`;
    
    // Progress Bar Horizontal (Cash vs Leasing)
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

    // MENJALANKAN RENDER GRAFIK & LIST PERINGKAT
    renderAgingChart(aging);
    renderDonutLeasing(s.cash, s.leas);
    renderLeasingProgressLines(mLeas, s.leas);
    renderTopList(mSales, 'list-sales', 'text-blue-600');
    renderTopList(mSpv, 'list-spv', 'text-purple-600');
    renderOverdueTopList(data);
    
    // RENDER TABEL DETAIL CONTROL
    renderDataArUnitFull(data); 
    renderTabDatabaseFull(data); 
}

// 3. LOGIKA RENDER APEXCHARTS & VISUAL LIST
function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging");
    if (!el) return;
    
    const valuesInMillions = Object.values(agingData).map(v => Math.round(v / 1000000));
    const options = {
        series: [{ name: 'Nominal (Juta)', data: valuesInMillions }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 4, distributed: true, dataLabels: { position: 'top' } } },
        dataLabels: { enabled: true, formatter: (v) => v > 0 ? v + " JT" : "", style: { fontSize: '9px', fontWeight: '800' }, offsetY: -20 },
        xaxis: { categories: Object.keys(agingData), labels: { style: { fontSize: '9px', fontWeight: '700' } } },
        yaxis: { show: false },
        grid: { show: false },
        legend: { show: false }
    };

    if (charts.bar && typeof charts.bar.destroy === 'function') { charts.bar.destroy(); }
    el.innerHTML = '';
    charts.bar = new ApexCharts(el, options); 
    charts.bar.render();
}

function renderDonutLeasing(totalCash, totalLeasing) {
    const el = document.querySelector("#chart-donut-leasing");
    if (!el) return;

    const options = {
        series: [Number(totalCash), Number(totalLeasing)],
        labels: ['TOTAL CASH', 'TOTAL LEASING'],
        chart: { type: 'donut', height: 220 },
        legend: { show: false },
        dataLabels: { enabled: false },
        colors: ['#10B981', '#3B82F6'],
        plotOptions: { pie: { donut: { size: '70%' } } }
    };

    if (charts.donut && typeof charts.donut.destroy === 'function') { charts.donut.destroy(); }
    el.innerHTML = '';
    charts.donut = new ApexCharts(el, options); 
    charts.donut.render();
}

function renderLeasingProgressLines(map, totalLeasing) {
    const el = document.getElementById('leasing-list');
    if (!el) return;
    
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    el.innerHTML = sorted.map(([name, value]) => {
        const pct = totalLeasing > 0 ? ((value / totalLeasing) * 100).toFixed(1) : 0;
        return `
        <div class="mb-3 font-bold uppercase">
            <div class="flex justify-between text-[10px] mb-1">
                <span class="text-slate-700">${name}</span>
                <span class="text-slate-500">${pct}%</span>
            </div>
            <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-blue-600 h-full rounded-full" style="width: ${pct}%"></div>
            </div>
        </div>`;
    }).join('');
}

function renderTopList(map, id, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
    el.innerHTML = sorted.map((item, i) => `
        <div class="flex justify-between items-center py-2.5 border-b border-slate-50 uppercase font-bold text-[10px]">
            <span class="text-slate-600 truncate w-40">${i+1}. ${item[0]}</span>
            <span class="${colorClass}">${fmtJuta(item[1])}</span>
        </div>`).join('');
}

function renderOverdueTopList(data) {
    const el = document.getElementById('list-overdue');
    if (!el) return;
    
    const filtered = data.filter(d => getNum(d, ['total_overdue', 'overdue']) > 0)
                         .sort((a, b) => getNum(b, ['total_overdue', 'overdue']) - getNum(a, ['total_overdue', 'overdue']))
                         .slice(0, 5);
                         
    el.innerHTML = filtered.map((d, i) => `
        <div class="flex justify-between items-center py-2.5 border-b border-slate-50 uppercase font-bold text-[10px]">
            <span class="text-slate-600 truncate w-40">${i+1}. ${getStr(d, ['customer_name', 'customer'])}</span>
            <span class="text-red-500">${fmtJuta(getNum(d, ['total_overdue', 'overdue']))}</span>
        </div>`).join('');
}

// 4. RENDER TABEL UTAMA DAN DATABASE (STRUKTUR DIJAMIN TETAP SAMA)
function renderDataArUnitFull(data) {
    const el = document.getElementById('tab-ar-unit-body');
    if (!el) return;

    const filterAR = data.filter(d => {
        const l = getStr(d, ['leasing_name', 'leasing']).toUpperCase();
        return l.includes('TAFS') || l.includes('ACC');
    });

    if(filterAR.length === 0) { 
        el.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-400 font-bold">Tidak ada unit TAFS / ACC</td></tr>'; 
        return; 
    }

    el.innerHTML = filterAR.map((d, i) => {
        const dbId = d.id || d.No || '';
        const customerName = getStr(d, ['customer_name']);
        return `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap text-[11px]">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4 text-slate-800 font-black">${customerName}</td>
            <td class="p-4">
                <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded text-[9px] font-extrabold">${getStr(d, ['leasing_name', 'leasing'])}</span>
            </td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(getNum(d, ['os_balance', 'osbalance']))}</td>
            <td class="p-4"><input type="text" id="cabang-${i}" data-dbid="${dbId}" data-customer="${customerName}" value="${d.ket_cabang || ''}" placeholder="Ket cabang..." class="input-custom bg-white"></td>
            <td class="p-4"><input type="text" id="plan-${i}" value="${d.plan_bayar_leasing || ''}" placeholder="Isi plan..." class="input-custom bg-white"></td>
            <td class="p-4"><input type="text" id="ket-${i}" value="${d.ket_leasing || ''}" placeholder="Isi keterangan..." class="input-custom bg-white"></td>
            <td class="p-4 text-center"><button onclick="simpanCatatan('${i}')" class="text-blue-600 bg-blue-50 p-2 rounded-lg hover:bg-blue-600 hover:text-white transition-all">💾</button></td>
        </tr>`;
    }).join('');
}

function renderTabDatabaseFull(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;

    el.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap text-[11px]">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4 text-slate-800 font-black">${getStr(d, ['customer_name'])}</td>
            <td class="p-4"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">${getStr(d, ['leasing_name', 'leasing']) || 'CASH'}</span></td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(getNum(d, ['os_balance', 'osbalance']))}</td>
            <td class="p-4 text-right text-emerald-600">${fmtIDR(getNum(d, ['lancar', 'hari_1_30']))}</td>
            <td class="p-4 text-right text-amber-500">${fmtIDR(getNum(d, ['hari_31_60']))}</td>
            <td class="p-4 text-right text-orange-500">${fmtIDR(getNum(d, ['lebih_60_hari']))}</td>
            <td class="p-4 text-right text-red-600 font-black bg-red-50/30">${fmtIDR(getNum(d, ['total_overdue', 'overdue']))}</td>
        </tr>`);
}

// 5. FIX LOGIKA ACTION SIMPAN CATATAN & REDIRECT KE TAFS.HTML
window.simpanCatatan = async function(uiId) {
    try {
        const inputCabang = document.getElementById(`cabang-${uiId}`);
        const inputPlan = document.getElementById(`plan-${uiId}`);
        const inputKet = document.getElementById(`ket-${uiId}`);

        if (!inputCabang) {
            alert("Elemen input tidak ditemukan!");
            return;
        }

        const dbId = inputCabang.getAttribute('data-dbid');
        const customerName = inputCabang.getAttribute('data-customer');

        const valCabang = inputCabang.value;
        const valPlan = inputPlan ? inputPlan.value : '';
        const valKet = inputKet ? inputKet.value : '';

        // Tampilkan loading di tombol saat proses berjalan
        const btnSaves = document.querySelectorAll(`button[onclick="simpanCatatan('${uiId}')"]`);
        if (btnSaves.length > 0) btnSaves[0].innerText = "⏳";

        let matchQuery = supabase.from('ar_unit').update({
            ket_cabang: valCabang,
            plan_bayar_leasing: valPlan,
            ket_leasing: valKet
        });

        if (dbId && dbId !== "undefined" && dbId !== "") {
            matchQuery = isNaN(dbId) ? matchQuery.eq('id', dbId) : matchQuery.eq('No', Number(dbId));
        } else {
            matchQuery = matchQuery.eq('customer_name', customerName);
        }

        const { error } = await matchQuery;
        if (error) throw error;
        
        // Memunculkan alert sukses simpan
        alert("Catatan penagihan unit berhasil disimpan! 👍");
        
        // JALUR REDIRECT INSTAN KE HALAMAN TAFS.HTML
        window.location.href = "tafs.html";

    } catch (err) {
        console.error("Error saat menyimpan:", err);
        alert("Gagal menyimpan data: " + err.message);
        
        const btnSaves = document.querySelectorAll(`button[onclick="simpanCatatan('${uiId}')"]`);
        if (btnSaves.length > 0) btnSaves[0].innerText = "💾";
    }
}

// 6. DOWNLOAD EXCEL
function downloadExcel() {
    if (!cachedData || cachedData.length === 0) {
        alert("Data belum siap atau masih memuat. Silakan tunggu sebentar.");
        return;
    }

    try {
        const dataUntukExcel = cachedData.map((d, index) => ({
            "No": index + 1,
            "Nama Customer": getStr(d, ['customer_name']),
            "No SPK": getStr(d, ['no_spk']),
            "Leasing": getStr(d, ['leasing_name', 'leasing']) || "CASH",
            "O/S Balance": getNum(d, ['os_balance', 'osbalance']),
            "Hari 1-30 (Lancar)": getNum(d, ['lancar', 'hari_1_30']),
            "Hari 31-60": getNum(d, ['hari_31_60']),
            "Lebih 60 Hari": getNum(d, ['lebih_60_hari']),
            "Total Overdue": getNum(d, ['total_overdue', 'overdue']),
            "Potensi Penalti": getNum(d, ['penalty_amount', 'penalty']),
            "Salesman": getStr(d, ['salesman_name']),
            "Supervisor": getStr(d, ['supervisor_name']),
            "Keterangan Cabang": d.ket_cabang || "",
            "Plan Bayar Leasing": d.plan_bayar_leasing || "",
            "Keterangan Leasing": d.ket_leasing || ""
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataUntukExcel);
        const workbook = XLSX.utils.book_new();
        const tglHariIni = new Date().toISOString().slice(0, 10);
        const namaFile = `Report_AR_Unit_Auto2000_${tglHariIni}.xlsx`;

        XLSX.utils.book_append_sheet(workbook, worksheet, "Data AR Unit");
        XLSX.writeFile(workbook, namaFile);

    } catch (error) {
        console.error("Gagal mendownload Excel:", error);
        alert("Terjadi masalah saat memproses Excel: " + error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    const btnDownload = document.getElementById('btn-download-excel');
    if (btnDownload) {
        btnDownload.addEventListener('click', downloadExcel);
    }
});