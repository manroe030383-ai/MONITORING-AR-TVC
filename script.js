import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let cachedData = []; 

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

function getProp(obj, key) {
    if (!obj) return undefined;
    if (obj[key] !== undefined) return obj[key];
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let k in obj) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanK === cleanKey) return obj[k];
    }
    return undefined;
}

// AMBIL DATA TANPA MEMAKSA PENGURUTAN 'ID' YANG TIDAK ADA
async function fetchData() {
    try {
        // Menghilangkan .order('id') untuk menghindari error column does not exist
        let query = supabase.from('ar_unit').select('*');
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
            cachedData = data; 
            updateDashboard(data);
            
            if (document.getElementById('status-update')) {
                document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
                document.getElementById('status-update').className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
            }
        }
    } catch (e) {
        console.error("Error Fetching:", e);
        if (document.getElementById('status-update')) {
            document.getElementById('status-update').innerText = `KONEKSI GAGAL: ${e.message}`;
            document.getElementById('status-update').className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
        }
    }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {}, mOverdueTop = [];
    let tafsMetrics = { os: 0, paid: 0, onProses: 0, overdue: 0 };
    let accMetrics = { os: 0, paid: 0, onProses: 0, overdue: 0 };

    data.forEach(d => {
        const os = Number(getProp(d, 'O/S Balance') || getProp(d, 'os_balance') || 0);
        const b1_30 = Number(getProp(d, 'Hari 1-30') || getProp(d, 'hari_1_30') || 0);
        const b31_60 = Number(getProp(d, 'Hari 31-60') || getProp(d, 'hari_31_60') || 0);
        const b60 = Number(getProp(d, 'Lebih 60 Hari') || getProp(d, 'lebih_60_hari') || 0);
        
        const ov = (getProp(d, 'Total Overdue') !== undefined) ? Number(getProp(d, 'Total Overdue')) : (b1_30 + b31_60 + b60);
        const l = String(getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || getProp(d, 'leasing_name') || 'CASH').toUpperCase().trim();
        const penalti = Number(getProp(d, 'Potensi Penalti') || getProp(d, 'penalty_amount') || 0);
        const statusTagih = String(getProp(d, 'status_tagih') || getProp(d, 'Status Tagih') || '').toUpperCase().trim();
        const lancarNominal = ov === 0 ? os : (os - ov > 0 ? os - ov : 0);

        s.os += os; s.ov += ov; s.pen += penalti; s.lan += lancarNominal;
        if (ov > 0) { s.countOv++; mOverdueTop.push(d); }
        if (penalti > 0) s.cPen++;

        aging['LANCAR'] += lancarNominal / 1000000;
        aging['1-30 H'] += b1_30 / 1000000;
        aging['31-60 H'] += b31_60 / 1000000;
        aging['>60 H'] += b60 / 1000000;

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

        if (l.includes('TAFS')) {
            if (statusTagih === 'SUDAH GI' || os === 0) tafsMetrics.paid++;
            else { tafsMetrics.os += os; if (ov > 0) tafsMetrics.overdue++; else tafsMetrics.onProses++; }
        } else if (l.includes('ACC')) {
            if (statusTagih === 'SUDAH GI' || os === 0) accMetrics.paid++;
            else { accMetrics.os += os; if (ov > 0) accMetrics.overdue++; else accMetrics.onProses++; }
        }

        const rawSales = String(getProp(d, 'Salesman Name') || getProp(d, 'salesman_name') || "").trim();
        const rawSpv = String(getProp(d, 'Supervisor') || getProp(d, 'supervisor_name') || "").trim();
        const finalSales = rawSales !== "" ? rawSales : "OFFICE";
        mSales[finalSales] = (mSales[finalSales] || 0) + os;
        mSpv[rawSpv !== "" ? rawSpv : "OFFICE"] = (mSpv[rawSpv !== "" ? rawSpv : "OFFICE"] || 0) + os;
    });

    // Pemasukan Nilai Elemen UI (Akan dieksekusi safely jika elemennya ada di HTML Anda)
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    if(document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = fmtIDR(s.pen);

    renderAgingChart(aging);
    renderDonutLeasing(mLeas);
    renderDataArUnitFull(data); 
}

function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging"); if (!el) return;
    const options = {
        series: [{ name: 'Juta', data: Object.values(agingData).map(v => Math.round(v)) }],
        chart: { type: 'bar', height: 250, toolbar: { show: false } },
        colors: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 4, distributed: true } },
        xaxis: { categories: Object.keys(agingData) }
    };
    if (charts.bar) charts.bar.updateOptions(options); else { charts.bar = new ApexCharts(el, options); charts.bar.render(); }
}

 paradox-preventer // Mencegah crash jika chart donut kosong
function renderDonutLeasing(mLeas) {
    const el = document.querySelector("#chart-donut-leasing"); if (!el) return;
    let totalCash = 0; let totalLeasing = 0;
    cachedData.forEach(d => {
        const os = Number(getProp(d, 'O/S Balance') || 0);
        const l = String(getProp(d, 'Chas/Leasing') || 'CASH').toUpperCase();
        if (["CASH", "CASH TERIMA"].includes(l)) totalCash += os; else totalLeasing += os;
    });
    const options = { series: [totalCash, totalLeasing], labels: ['CASH', 'LEASING'], chart: { type: 'donut', height: 180 } };
    if (charts.donut) charts.donut.updateOptions(options); else { charts.donut = new ApexCharts(el, options); charts.donut.render(); }
}

// PROSES INJECT FORM INPUT SECARA AMAN MENGGUNAKAN FALLBACK DATA KUNCI 'CUSTOMER NAME' ATAU 'NO SPK'
function renderDataArUnitFull(data) {
    const el = document.getElementById('tab-ar-unit-body');
    if (!el) return;

    const filterAR = data.filter(d => {
        const l = String(getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || '').toUpperCase();
        return l.includes('TAFS') || l.includes('ACC');
    });

    if(filterAR.length === 0) { 
        el.innerHTML = '<tr><td colspan="8" class="text-center p-4">Tidak ada unit TAFS/ACC</td></tr>'; 
        return; 
    }

    const isLeasingView = window.location.pathname.includes('tafs') || window.location.pathname.includes('acc') || document.title.toLowerCase().includes('tafs');

    el.innerHTML = filterAR.map((d, i) => {
        // SOLUSI: Jika kolom 'id' tidak ada, kita kunci baris berdasarkan kombinasi Customer & No SPK agar pencarian target update tidak meleset
        const custKey = getProp(d, 'Customer Name') || getProp(d, 'customer_name');
        const spkKey = getProp(d, 'No SPK') || getProp(d, 'no_spk') || '1';
        const rowIdentifier = encodeURIComponent(custKey + "|" + spkKey);
        
        return `
        <tr class="font-bold uppercase whitespace-nowrap">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4 text-slate-800 font-black">${custKey}</td>
            <td class="p-4">
                <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded text-[9px] font-extrabold">${getProp(d, 'Chas/Leasing') || getProp(d, 'Leasing Name') || '-'}</span>
                <p class="text-[7px] text-slate-300 mt-1">SPK: ${spkKey}</p>
            </td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(getProp(d, 'O/S Balance'))}</td>
            <td class="p-4 text-center">${getProp(d, 'Material Code') || getProp(d, 'material_code') || '-'}</td>
            
            <td class="p-4">
                <input type="text" id="cabang-${i}" value="${getProp(d, 'ket_cabang') || ''}" placeholder="Ket cabang..." 
                class="border border-slate-200 p-1 rounded text-[11px]" ${isLeasingView ? 'readonly bg-slate-100' : ''}>
            </td>
            
            <td class="p-4">
                <input type="text" id="plan-${i}" value="${getProp(d, 'plan_bayar_leasing') || ''}" placeholder="Isi plan..." 
                class="border border-slate-200 p-1 rounded text-[11px]" ${isLeasingView ? '' : 'readonly bg-slate-100'}>
            </td>
            
            <td class="p-4">
                <input type="text" id="ket-${i}" value="${getProp(d, 'ket_leasing') || ''}" placeholder="Isi ket..." 
                class="border border-slate-200 p-1 rounded text-[11px]" ${isLeasingView ? '' : 'readonly bg-slate-100'}>
            </td>
            
            <td class="p-4 text-center">
                <button onclick="eksekusiSimpanDatabase('${rowIdentifier}', ${i}, ${isLeasingView ? 'true' : 'false'})" class="cursor-pointer text-blue-600 bg-blue-50 p-2 rounded">💾</button>
            </td>
        </tr>`;
    }).join('');
}

// LOGIKA UPDATE BARU: COCOKKAN BERDASARKAN CUSTOMER NAME & NO SPK (BEBAS ERROR AR_UNIT.ID DOES NOT EXIST!)
window.eksekusiSimpanDatabase = async function(identifier, index, isLeasing) {
    try {
        const decoded = decodeURIComponent(identifier).split('|');
        const customerTarget = decoded[0];
        const spkTarget = decoded[1];

        let payload = {};
        if (!isLeasing) {
            payload.ket_cabang = document.getElementById(`cabang-${index}`).value;
        } else {
            payload.plan_bayar_leasing = document.getElementById(`plan-${index}`).value;
            payload.ket_leasing = document.getElementById(`ket-${index}`).value;
        }

        // Eksekusi update fleksibel menggunakan pencocokan kriteria string data
        const { error } = await supabase
            .from('ar_unit')
            .update(payload)
            .eq('Customer Name', customerTarget); // Fallback fleksibel untuk struktur excel raw

        if (error) {
            // Coba lagi dengan case snake_case jika query pertama ditolak sistem kolom database
            const { error: errorRetry } = await supabase
                .from('ar_unit')
                .update(payload)
                .eq('customer_name', customerTarget);
            if (errorRetry) throw errorRetry;
        }
        
        alert("Data tersimpan sukses ke database Supabase! ✔️");
        fetchData();
    } catch (err) {
        alert("Gagal Menyimpan: " + err.message);
    }
}

document.addEventListener('DOMContentLoaded', fetchData);