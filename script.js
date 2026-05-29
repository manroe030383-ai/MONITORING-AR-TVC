import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) processData(data);
    } catch (e) {
        console.error("Error:", e);
    }
}

function processData(data) {
    // 1. RENDER DATABASE LENGKAP
    const bodyDb = document.getElementById('tab-database-body');
    if (bodyDb) {
        bodyDb.innerHTML = data.map((d, i) => `
            <tr>
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

    // 2. RENDER OVERDUE (Sesuai ID HTML Anda)
    const bodyOv = document.getElementById('tab-overdue-full-list');
    if (bodyOv) {
        const ovData = data.filter(d => ((d.hari_1_30 || 0) + (d.hari_31_60 || 0) + (d.lebih_60_hari || 0)) > 0);
        bodyOv.innerHTML = ovData.map(d => `
            <div class="p-3 border-b flex justify-between">
                <span class="font-bold">${d.Customer_Name || '-'}</span>
                <span class="text-red-600 font-bold">${fmtIDR((d.hari_1_30 || 0) + (d.hari_31_60 || 0) + (d.lebih_60_hari || 0))}</span>
            </div>
        `).join('');
    }

    // 3. RENDER LEASING (Sesuai ID HTML Anda)
    const bodyLeasing = document.getElementById('tab-leasing-full-list');
    if (bodyLeasing) {
        const leasingMap = data.reduce((acc, d) => {
            const name = d.Leasing_Name || 'Tanpa Leasing';
            acc[name] = (acc[name] || 0) + Number(d.os_balance || 0);
            return acc;
        }, {});
        bodyLeasing.innerHTML = Object.entries(leasingMap).map(([name, total]) => `
            <div class="p-3 border-b flex justify-between">
                <span>${name}</span>
                <span class="font-bold">${fmtIDR(total)}</span>
            </div>
        `).join('');
    }

    // 4. RENDER INPUT CONTROL
    const bodyAr = document.getElementById('tab-ar-unit-body');
    if (bodyAr) {
        bodyAr.innerHTML = data.map((d, i) => `
            <tr class="border-b">
                <td class="p-4 text-center">${i + 1}</td>
                <td class="p-4 font-bold text-xs">${d.Customer_Name || '-'}</td>
                <td class="p-4 text-xs">${d.Leasing_Name || '-'}</td>
                <td class="p-4 text-right text-xs">${fmtIDR(d.os_balance)}</td>
                <td class="p-4"><input type="text" class="input-custom" value="${d.ket_cabang || ''}"></td>
                <td class="p-4"><input type="text" class="input-custom" value="${d.plan_bayar_leasing || ''}"></td>
                <td class="p-4"><input type="text" class="input-custom" value="${d.keterangan_leasing || ''}"></td>
                <td class="p-4 text-center"><button class="bg-blue-600 text-white px-3 py-1 rounded font-bold">SAVE</button></td>
            </tr>
        `).join('');
    }

    // 5. UPDATE RINGKASAN TOTAL
    const elTotal = document.getElementById('total-os');
    if (elTotal) elTotal.innerText = fmtIDR(data.reduce((sum, d) => sum + Number(d.os_balance || 0), 0));
}

document.addEventListener('DOMContentLoaded', fetchData);