import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// KONFIGURASI
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let cachedData = [];

// Helper untuk menangani nama kolom yang tidak konsisten
function getProp(obj, keys) {
    if (!obj) return 0;
    const arrayKeys = Array.isArray(keys) ? keys : [keys];
    for (let key of arrayKeys) {
        if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    }
    return 0;
}

// FUNGSI UTAMA FETCH DATA
async function fetchData() {
    try {
        const { data, error } = await supabase
            .from('ar_unit')
            .select('*')
            .range(0, 5000); // Pastikan mengambil hingga 5000 data

        if (error) throw error;

        cachedData = data || [];
        updateDashboard(cachedData);
        
        console.log("Data berhasil disinkronisasi:", cachedData.length, "baris");
    } catch (e) {
        console.error("Gagal sinkronisasi:", e);
    }
}

// LOGIKA PEMBARUAN DASHBOARD
function updateDashboard(data) {
    let s = { os: 0, ov: 0, cash: 0, leas: 0 };

    data.forEach(d => {
        const os = Number(getProp(d, ['O/S Balance', 'os_balance']));
        const ov = Number(getProp(d, ['Total Overdue', 'total_overdue']));
        const l = String(getProp(d, ['Chas/Leasing', 'Leasing Name', 'leasing_name'])).toUpperCase();

        s.os += os;
        s.ov += ov;
        if (l.includes('CASH')) s.cash += os;
        else s.leas += os;
    });

    // Update UI (Gunakan ID yang ada di HTML Anda)
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = s.os.toLocaleString('id-ID');
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = s.ov.toLocaleString('id-ID');
}

// REALTIME LISTENER (Agar tidak perlu reload halaman)
supabase
    .channel('public:ar_unit')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ar_unit' }, () => {
        console.log("Perubahan terdeteksi, melakukan refetch...");
        fetchData();
    })
    .subscribe();

// INISIALISASI
document.addEventListener('DOMContentLoaded', fetchData);