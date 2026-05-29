import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) processData(data);
    } catch (e) { console.error("Error Fetching:", e); }
}

function processData(data) {
    // 1. RINGKASAN ATAS
    const totalOs = data.reduce((sum, d) => sum + Number(d.os_balance || 0), 0);
    const overdueList = data.filter(d => ((d.hari_1_30 || 0) + (d.hari_31_60 || 0) + (d.lebih_60_hari || 0)) > 0);
    const totalOverdue = overdueList.reduce((sum, d) => sum + ((d.hari_1_30 || 0) + (d.hari_31_60 || 0) + (d.lebih_60_hari || 0)), 0);
    
    document.getElementById('total-os').innerText = fmtIDR(totalOs);
    document.getElementById('total-overdue').innerText = fmtIDR(totalOverdue);
    document.getElementById('badge-overdue').innerText = `${overdueList.length} SPK Lewat TOP`;

    // 2. WIDGET KANAN & KIRI
    document.getElementById('list-overdue').innerHTML = overdueList
        .sort((a, b) => ((b.hari_1_30 + b.hari_31_60 + b.lebih_60_hari) - (a.hari_1_30 + a.hari_31_60 + a.lebih_60_hari)))
        .slice(0, 5)
        .map(d => `<div class="flex justify-between text-[10px]"><span class="truncate w-3/5 font-bold">${d.Customer_Name}</span><span class="text-red-600 font-black">${fmtIDR((d.hari_1_30 || 0) + (d.hari_31_60 || 0) + (d.lebih_60_hari || 0))}</span></div>`).join('');

    document.getElementById('list-sales').innerHTML = data
        .sort((a, b) => b.os_balance - a.os_balance)
        .slice(0, 5)
        .map(d => `<div class="flex justify-between text-[10px]"><span class="font-bold">${d.Customer_Name}</span><span class="font-black">${fmtIDR(d.os_balance)}</span></div>`).join('');

    // 3. TAB DATABASE & TAB LAINNYA
    document.getElementById('tab-database-body').innerHTML = data.map((d, i) => `
        <tr>
            <td class="p-4 text-center">${i + 1}</td>
            <td class="p-4 font-bold">${d.Customer_Name}</td>
            <td class="p-4">${d.Leasing_Name}</td>
            <td class="p-4 text-right">${fmtIDR(d.os_balance)}</td>
            <td class="p-4 text-right">${d.hari_1_30 || 0}</td>
            <td class="p-4 text-right">${d.hari_31_60 || 0}</td>
            <td class="p-4 text-right">${d.lebih_60_hari || 0}</td>
            <td class="p-4 text-right font-bold text-red-600">${fmtIDR((d.hari_1_30 || 0) + (d.hari_31_60 || 0) + (d.lebih_60_hari || 0))}</td>
        </tr>`).join('');

    document.getElementById('tab-overdue-full-list').innerHTML = overdueList
        .map(d => `<div class="p-3 border-b flex justify-between"><span class="font-bold">${d.Customer_Name}</span><span class="text-red-600 font-bold">${fmtIDR((d.hari_1_30 || 0) + (d.hari_31_60 || 0) + (d.lebih_60_hari || 0))}</span></div>`).join('');

    // 4. TAB LEASING
    const leasingMap = data.reduce((acc, d) => { acc[d.Leasing_Name] = (acc[d.Leasing_Name] || 0) + Number(d.os_balance || 0); return acc; }, {});
    document.getElementById('tab-leasing-full-list').innerHTML = Object.entries(leasingMap).map(([name, total]) => `
        <div class="p-3 border-b flex justify-between"><span>${name}</span><span class="font-bold">${fmtIDR(total)}</span></div>`).join('');

    // 5. INPUT CONTROL
    document.getElementById('tab-ar-unit-body').innerHTML = data.map((d, i) => `
        <tr class="border-b">
            <td class="p-4 text-center">${i + 1}</td>
            <td class="p-4 font-bold text-xs">${d.Customer_Name}</td>
            <td class="p-4 text-xs">${d.Leasing_Name}</td>
            <td class="p-4 text-right text-xs">${fmtIDR(d.os_balance)}</td>
            <td class="p-4"><input type="text" class="input-custom" value="${d.ket_cabang || ''}"></td>
            <td class="p-4"><input type="text" class="input-custom" value="${d.plan_bayar_leasing || ''}"></td>
            <td class="p-4"><input type="text" class="input-custom" value="${d.keterangan_leasing || ''}"></td>
            <td class="p-4 text-center"><button class="bg-blue-600 text-white px-2 py-1 rounded text-[9px] font-bold">SAVE</button></td>
        </tr>`).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);