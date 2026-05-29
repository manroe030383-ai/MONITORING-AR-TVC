import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// FORMATER MATA UANG
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR', 
    maximumFractionDigits: 0 
}).format(v || 0);

// FUNGSI UTAMA AMBIL DATA
async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        
        if (error) {
            console.error("Error Fetching:", error);
            return;
        }
        
        if (data) {
            processData(data);
        }
    } catch (e) {
        console.error("Terjadi kesalahan:", e);
    }
}

// FUNGSI PENGOLAHAN DATA
function processData(data) {
    // 1. Render Tabel Database Lengkap
    const bodyDb = document.getElementById('tab-database-body');
    if (bodyDb) {
        bodyDb.innerHTML = data.map((d, i) => `
            <tr class="hover:bg-slate-50 border-b border-slate-50">
                <td class="p-4 text-center">${i + 1}</td>
                <td class="p-4 font-bold">${d.Customer_Name || '-'}</td>
                <td class="p-4">${d.Leasing_Name || '-'}</td>
                <td class="p-4 text-right">${fmtIDR(d.os_balance)}</td>
                <td class="p-4 text-right">${d.hari_1_30 || 0}</td>
                <td class="p-4 text-right">${d.hari_31_60 || 0}</td>
                <td class="p-4 text-right">${d.lebih_60_hari || 0}</td>
                <td class="p-4 text-right font-bold text-red-600">${fmtIDR((d.hari_1_30 || 0) + (d.hari_31_60 || 0) + (d.lebih_60_hari || 0))}</td>
            </tr>
        `).join('');
    }

    // 2. Render Tabel Overdue
    const overdueData = data.filter(d => ((d.hari_1_30 || 0) + (d.hari_31_60 || 0) + (d.lebih_60_hari || 0)) > 0);
    const bodyOv = document.getElementById('tab-overdue-full-list');
    if (bodyOv) {
        bodyOv.innerHTML = overdueData.map(d => `
            <div class="p-3 border border-red-100 bg-red-50/50 rounded-lg flex justify-between items-center mb-2">
                <span class="font-bold text-xs">${d.Customer_Name || '-'}</span>
                <span class="text-red-600 font-black text-xs">${fmtIDR((d.hari_1_30 || 0) + (d.hari_31_60 || 0) + (d.lebih_60_hari || 0))}</span>
            </div>
        `).join('');
    }

    // 3. Render Tabel Input (Data AR Unit)
    const bodyAr = document.getElementById('tab-ar-unit-body');
    if (bodyAr) {
        bodyAr.innerHTML = data.map((d, i) => `
            <tr class="border-b border-slate-50">
                <td class="p-4 text-center">${i + 1}</td>
                <td class="p-4 font-bold text-xs">${d.Customer_Name || '-'}</td>
                <td class="p-4 text-xs">${d.Leasing_Name || '-'}</td>
                <td class="p-4 text-right text-xs">${fmtIDR(d.os_balance)}</td>
                <td class="p-4"><input type="text" class="input-custom border rounded p-1 w-full" value="${d.ket_cabang || ''}"></td>
                <td class="p-4"><input type="text" class="input-custom border rounded p-1 w-full" value="${d.plan_bayar_leasing || ''}"></td>
                <td class="p-4"><input type="text" class="input-custom border rounded p-1 w-full" value="${d.keterangan_leasing || ''}"></td>
                <td class="p-4 text-center"><button class="bg-blue-600 text-white px-3 py-1 rounded text-[10px] font-bold">SAVE</button></td>
            </tr>
        `).join('');
    }

    // 4. Update Header Ringkasan
    let totalOs = data.reduce((sum, d) => sum + Number(d.os_balance || 0), 0);
    const elTotalOs = document.getElementById('total-os');
    if (elTotalOs) {
        elTotalOs.innerText = fmtIDR(totalOs);
    }
}

// INITIALIZE
document.addEventListener('DOMContentLoaded', fetchData);