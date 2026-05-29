import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// KONFIGURASI
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let cachedData = [];

// FUNGSI UTAMA: MENGAMBIL DATA
async function fetchData() {
    try {
        const { data, error } = await supabase
            .from('ar_unit')
            .select('*');

        if (error) throw error;
        
        cachedData = data;
        renderDashboard(data);
        console.log("Data berhasil dimuat:", data.length, "baris");
    } catch (e) {
        console.error("Error Fetching:", e.message);
        document.getElementById('status-update').innerText = "Gagal koneksi database!";
    }
}

// FUNGSI LOGIKA RENDER (Tampilan)
function renderDashboard(data) {
    const tbody = document.getElementById('tab-ar-unit-body');
    if (!tbody) return;

    tbody.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50 border-b">
            <td class="p-4 text-center">${i + 1}</td>
            <td class="p-4 font-bold">${d.customer_name || '-'}</td>
            <td class="p-4">${d.leasing_name || 'CASH'}</td>
            <td class="p-4 text-right">Rp ${Number(d.os_balance).toLocaleString()}</td>
            <td class="p-4 text-center">
                <input type="text" id="ket-${d.no_spk}" value="${d.ket_cabang || ''}" 
                       class="border rounded p-1 text-xs" placeholder="Catatan...">
                <button onclick="saveData('${d.no_spk}')" class="ml-2 text-blue-600 font-bold">Simpan</button>
            </td>
        </tr>
    `).join('');
}

// FUNGSI UPDATE DATA (CRUD)
window.saveData = async (spk) => {
    const val = document.getElementById(`ket-${spk}`).value;
    
    const { error } = await supabase
        .from('ar_unit')
        .update({ ket_cabang: val })
        .eq('no_spk', spk);

    if (error) {
        alert("Gagal menyimpan: " + error.message);
    } else {
        alert("Berhasil!");
    }
};

// SINKRONISASI REALTIME
supabase.channel('public:ar_unit')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ar_unit' }, fetchData)
    .subscribe();

// JALANKAN SAAT LOAD
document.addEventListener('DOMContentLoaded', fetchData);