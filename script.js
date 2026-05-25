import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// ========================================================
// 1. KONFIGURASI DATABASE SUPABASE (TETAP UTUH)
// ========================================================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = { bar: null, donut: null }; 
let cachedData = []; 

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

function getProp(obj, key) {
    if (!obj) return undefined;
    if (obj[key] !== undefined) return obj[key];
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let k in obj) {
        if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanKey) return obj[k];
    }
    return undefined;
}

// ========================================================
// 2. AMBIL DATA LIVE DARI SUPABASE (DIPERBAIKI AGAR DETEKSI URL AKURAT)
// ========================================================
async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        
        if (data) {
            cachedData = data;
            
            // Deteksi URL yang jauh lebih aman (Membaca file lokal maupun web server)
            const currentURL = window.location.href.toLowerCase();
            
            if (currentURL.includes('tafs')) {
                renderHalamanLeasing(data, 'TAFS');
            } else if (currentURL.includes('acc')) {
                renderHalamanLeasing(data, 'ACC');
            } else {
                // Default jika membuka dashboard.html, index.html atau root domain
                updateDashboard(data);
            }
            
            // Update status text jika ada elemennya di HTML
            const statusEl = document.getElementById('status-update');
            if (statusEl) {
                statusEl.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
                statusEl.className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
            }
        }
    } catch (e) {
        console.error("Error Fetching Data:", e);
    }
}

// ========================================================
// 3. LOGIKA RENDER KHUSUS HALAMAN TAFS.HTML & ACC.HTML (TETAP UTUH)
// ========================================================
function renderHalamanLeasing(data, tipeLeasing) {
    let el = document.getElementById('tab-ar-unit-body') || document.querySelector('tbody');
    if (!el) {
        console.error("Elemen tbody tabel tidak ditemukan di HTML Anda!");
        return;
    }

    const dataFilter = data.filter(d => {
        const namaLeasing = String(getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || getProp(d, 'leasing_name') || '').toUpperCase();
        return namaLeasing.includes(tipeLeasing);
    });

    if (dataFilter.length === 0) {
        el.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-xs text-slate-400 italic">Tidak ada data aktif untuk leasing ${tipeLeasing}</td></tr>`;
        return;
    }

    el.innerHTML = dataFilter.map((d, i) => {
        const spkAsli = String(getProp(d, 'No SPK') || getProp(d, 'no_spk') || '').trim();
        const idSistem = spkAsli.replace(/[^a-zA-Z0-9]/g, '_');
        
        const ketCabangVal = d.ket_cabang || getProp(d, 'ket_cabang') || '';
        const planBayarVal = d.plan_bayar_leasing || getProp(d, 'plan_bayar_leasing') || '';
        const ketLeasingVal = d.ket_leasing || getProp(d, 'ket_leasing') || '';

        return `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap text-[10px] border-b border-slate-100">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4">
                <p class="text-slate-800 font-black text-[11px]">${getProp(d, 'Customer Name') || getProp(d, 'customer_name') || '-'}</p>
                <p class="text-[9px] text-slate-400 font-medium tracking-wide mt-0.5">${getProp(d, 'No Rekening') || getProp(d, 'no_rekening') || spkAsli}</p>
            </td>
            <td class="p-4">
                <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded text-[9px] font-extrabold tracking-wide">${tipeLeasing}</span>
                <p class="text-[9px] text-slate-400 font-medium tracking-wide mt-0.5">SPK: ${spkAsli}</p>
            </td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(getProp(d, 'O/S Balance') || getProp(d, 'os_balance'))}</td>
            
            <td class="p-4">
                <input type="text" id="cabang-${idSistem}" value="${ketCabangVal}" placeholder="Ket cabang..." class="border border-slate-200 rounded px-2 py-1 text-[10px] w-full font-medium bg-white">
            </td>
            
            <td class="p-4">
                <input type="text" id="plan-${idSistem}" value="${planBayarVal}" placeholder="Plan bayar..." class="border border-slate-200 rounded px-2 py-1 text-[10px] w-full font-medium bg-white">
            </td>
            
            <td class="p-4">
                <input type="text" id="ket-${idSistem}" value="${ketLeasingVal}" placeholder="Keterangan..." class="border border-slate-200 rounded px-2 py-1 text-[10px] w-full font-medium bg-white">
            </td>
            
            <td class="p-4 text-center">
                <button onclick="simpanSemuaCatatan('${spkAsli}')" class="text-blue-600 hover:bg-blue-600 hover:text-white bg-blue-50 p-2 rounded-lg transition-all" title="Simpan Perubahan">💾</button>
            </td>
        </tr>`;
    }).join('');
}

// ========================================================
// 4. FUNGSI UPDATE UTAMA HALAMAN DASHBOARD.HTML (TETAP UTUH)
// ========================================================
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {}, mOverdueTop = [];

    data.forEach(d => {
        const os = Number(getProp(d, 'O/S Balance') || getProp(d, 'os_balance') || 0);
        const b1_30 = Number(getProp(d, 'Hari 1-30') || getProp(d, 'hari_1_30') || 0);
        const b31_60 = Number(getProp(d, 'Hari 31-60') || getProp(d, 'hari_31_60') || 0);
        const b60 = Number(getProp(d, 'Lebih 60 Hari') || getProp(d, 'lebih_60_hari') || 0);
        const ov = b1_30 + b31_60 + b60;
        
        const l = String(getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || 'CASH').toUpperCase().trim();
        const penalti = Number(getProp(d, 'Potensi Penalti') || 0);
        const statusTagih = String(getProp(d, 'status_tagih') || getProp(d, 'Status Tagih') || '').toUpperCase().trim();
        const lancarNominal = ov === 0 ? os : (os - ov > 0 ? os - ov : 0);

        s.os += os; s.ov += ov; s.pen += penalti; s.lan += lancarNominal;
        if (ov > 0) { s.countOv++; mOverdueTop.push(d); }
        if (penalti > 0) s.cPen++;

        aging['LANCAR'] += lancarNominal; aging['1-30 H'] += b1_30; aging['31-60 H'] += b31_60; aging['>60 H'] += b60;

        if (["CASH", "CASH TERIMA", "", "-"].includes(l)) { 
            s.cash += os; s.cCash++; 
        } else { 
            s.leas += os; s.cLeas++; 
            mLeas[l] = (mLeas[l] || 0) + os; 
            if (l.includes('TAFS') || l.includes('ACC')) {
                tvc.total++;
                if (statusTagih === 'SUDAH GI') tvc.gi++; else tvc.deliv++;
            }
        }

        const rawSales = String(getProp(d, 'Salesman Name') || "").trim();
        const rawSpv = String(getProp(d, 'Supervisor') || "").trim();
        mSales[rawSales || "OFFICE"] = (mSales[rawSales || "OFFICE"] || 0) + os;
        mSpv[rawSpv || "OFFICE"] = (mSpv[rawSpv || "OFFICE"] || 0) + os;
    });

    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    if(document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    
    renderAgingChart(aging);
    renderDonutLeasing(mLeas);
    renderTabDatabaseFull(data);
}

// ========================================================
// 5. GLOBAL FUNCTION: AKSI SIMPAN DATA (TETAP UTUH)
// ========================================================
window.simpanSemuaCatatan = async function(nomorSPK) {
    try {
        const idSistem = nomorSPK.replace(/[^a-zA-Z0-9]/g, '_');
        const inputCabang = document.getElementById(`cabang-${idSistem}`);
        const inputPlan = document.getElementById(`plan-${idSistem}`);
        const inputKet = document.getElementById(`ket-${idSistem}`);
        
        if (!inputCabang || !inputPlan || !inputKet) return;

        const dataRow = cachedData.find(d => String(getProp(d, 'No SPK') || '').trim() === String(nomorSPK).trim());
        if (!dataRow) { alert("Data SPK tidak ditemukan."); return; }

        let kolomSPK = dataRow['No SPK'] !== undefined ? 'No SPK' : 'no_spk';

        const { error } = await supabase
            .from('ar_unit')
            .update({ 
                ket_cabang: inputCabang.value,
                plan_bayar_leasing: inputPlan.value,
                ket_leasing: inputKet.value
            })
            .eq(kolomSPK, nomorSPK);

        if (error) throw error;
        alert("✔️ Data SPK " + nomorSPK + " berhasil diperbarui ke database!");
        
    } catch (err) {
        console.error(err);
        alert("Gagal menyimpan data: " + err.message);
    }
}

// ========================================================
// FUNGSI LOGIKA GRAFIK & DATABASE PEMBANTU (TETAP UTUH)
// ========================================================
function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging"); if (!el) return;
    const options = {
        series: [{ name: 'IDR', data: Object.values(agingData) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        xaxis: { categories: Object.keys(agingData) }
    };
    if (charts.bar) charts.bar.updateOptions(options); else { charts.bar = new ApexCharts(el, options); charts.bar.render(); }
}

function renderDonutLeasing(mLeas) {
    const el = document.querySelector("#chart-donut-leasing"); if (!el) return;
    const options = {
        series: [1, 2], labels: ['CASH', 'LEASING'],
        chart: { type: 'donut', height: 180 }
    };
    if (charts.donut) charts.donut.updateOptions(options); else { charts.donut = new ApexCharts(el, options); charts.donut.render(); }
}

function renderTabDatabaseFull(data) {
    const el = document.getElementById('tab-database-body'); if (!el) return;
    el.innerHTML = data.map((d, i) => `
        <tr class="text-[10px] uppercase font-bold border-b border-slate-50">
            <td class="p-3 text-center">${i+1}</td>
            <td class="p-3">${getProp(d, 'Customer Name') || '-'}</td>
            <td class="p-3">${getProp(d, 'Chas/Leasing') || 'CASH'}</td>
            <td class="p-3 text-right text-blue-600">${fmtIDR(getProp(d, 'O/S Balance'))}</td>
            <td class="p-3 text-right text-red-600">${fmtIDR(Number(getProp(d, 'Hari 1-30')||0)+Number(getProp(d, 'Hari 31-60')||0)+Number(getProp(d, 'Lebih 60 Hari')||0))}</td>
        </tr>`).join('');
}

// ========================================================
// 6. INITIALIZATION & REALTIME SYNC (TETAP UTUH)
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    supabase.channel('public-ar-unit').on('postgres_changes', { event: '*', schema: 'public', table: 'ar_unit' }, () => {
        fetchData();
    }).subscribe();
});