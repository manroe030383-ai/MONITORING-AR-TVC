import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDatabase() {
    // 1. Cek apakah koneksi ke Supabase berhasil
    const { data, error } = await supabase.from('ar_unit').select('*');
    
    if (error) {
        console.error("DEBUG ERROR:", error);
        alert("Terjadi Error! Lihat Console (F12) untuk detailnya.");
    } else {
        console.log("DEBUG DATA:", data);
        if (data.length === 0) {
            alert("Koneksi ke Supabase berhasil, TAPI database Anda mengembalikan data kosong (0 baris).");
        } else {
            alert("Koneksi berhasil dan data ditemukan! Jumlah data: " + data.length);
        }
    }
}

checkDatabase();