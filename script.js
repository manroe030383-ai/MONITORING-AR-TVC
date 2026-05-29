import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Konfigurasi Supabase
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Fungsi Utama Tarik Data
async function initDashboard() {
    console.log("Memulai penarikan data...");
    
    const { data, error } = await supabase
        .from('ar_unit')
        .select('*');

    if (error) {
        console.error("Gagal menarik data:", error);
        return;
    }

    if (data) {
        console.log("Data berhasil ditemukan, jumlah:", data.length);
        renderARUnit(data);
        renderDatabase(data);
    }
}

// Fungsi Render untuk Input Control
function renderARUnit(data) {
    const tbody = document.getElementById('tab-ar-unit-body');
    if (!tbody) return;

    tbody.innerHTML = data.map((d, i) => `
        <tr>
            <td class="p-4 text-center">${i + 1}</td>
            <td class="p-4 font-bold">${d.customer_name || '-'}</td>
            <td class="p-4">${d.leasing_name || '-'}</td>
            <td class="p-4 text-right">Rp ${Number(d.os_balance).toLocaleString('id-ID')}</td>
            <td class="p-4"><input class="input-custom" value="${d.ket_cabang || ''}"></td>
            <td class="p-4"><input class="input-custom" value="${d.plan_bayar_leasing || ''}"></td>
            <td class="p-4"><input class="input-custom" value="${d.keterangan_leasing || ''}"></td>
            <td class="p-4 text-center">
                <button class="bg-blue-600 text-white px-2 py-1 rounded text-[9px]">SAVE</button>
            </td>
        </tr>
    `).join('');
}

// Fungsi Render untuk Database Lengkap
function renderDatabase(data) {
    const tbody = document.getElementById('tab-database-body');
    if (!tbody) return;

    tbody.innerHTML = data.map((d, i) => `
        <tr>
            <td class="p-4 text-center">${i + 1}</td>
            <td class="p-4">${d.customer_name || '-'}</td>
            <td class="p-4">${d.leasing_name || '-'}</td>
            <td class="p-4 text-right">Rp ${Number(d.os_balance).toLocaleString('id-ID')}</td>
            <td class="p-4 text-right">${d.hari_1_30 || 0}</td>
            <td class="p-4 text-right">${d.hari_31_60 || 0}</td>
            <td class="p-4 text-right">${d.lebih_60_hari || 0}</td>
            <td class="p-4 text-right font-bold text-red-600">Rp ${((Number(d.hari_1_30) || 0) + (Number(d.hari_31_60) || 0) + (Number(d.lebih_60_hari) || 0)).toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
}

// Jalankan saat halaman siap
document.addEventListener('DOMContentLoaded', initDashboard);