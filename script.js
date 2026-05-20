import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let cachedData = []; 

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

// FUNGSI UNTUK MENGANTISIPASI HURUF BESAR/KECIL PADA KOLOM DATABASE
function getProp(obj, key) {
    if (!obj) return undefined;
    // Cek huruf kecil standar
    if (obj[key.toLowerCase()] !== undefined) return obj[key.toLowerCase()];
    // Cek huruf besar standar
    if (obj[key.toUpperCase()] !== undefined) return obj[key.toUpperCase()];
    // Cek variasi key aslinya
    if (obj[key] !== undefined) return obj[key];
    
    // Cari manual jika ada kombinasi kapital seperti 'No' atau 'Ket_Cabang'
    const lowerKey = key.toLowerCase();
    for (let k in obj) {
        if (k.toLowerCase() === lowerKey) return obj[k];
    }
    return undefined;
}

// 1. FUNGSI AMBIL DATA DARI SUPABASE
async function fetchData() {
    try {
        // Mengambil data, jika os_balance gagal di-order karena masalah huruf kapital, system akan otomatis mengabaikan order dan mengambil data mentah
        let query = supabase.from('ar_unit').select('*');
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
            console.log("DATA DARI SUPABASE:", data); // Tetap dipasang untuk pengecekan mandiri
            
            if (data.length === 0) {
                if (document.getElementById('status-update')) {
                    document.getElementById('status-update').innerText = "KONEKSI SUKSES, TAPI TABEL DI SUPABASE KOSONG (0 DATA)!";
                    document.getElementById('status-update').className = "text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1 italic";
                }
                return;
            }

            cachedData = data; 
            updateDashboard(data);
            
            if (document.getElementById('status-update')) {
                document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
                document.getElementById('status-update').className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
            }

            if (document.getElementById('tgl-arsip')) {
                const opsiTanggal = { year: 'numeric', month: 'short', day: 'numeric' };
                document.getElementById('tgl-arsip').innerText = new Date().toLocaleDateString('id-ID', opsiTanggal).toUpperCase();
            }
        }
    } catch (e) {
        console.error("Error Fetching:", e);
        if (document.getElementById('status-update')) {
            document.getElementById('status-update').innerText = `KONEKSI GAGAL ATAU NAMA TABEL SALAH: ${e.message}`;
            document.getElementById('status-update').className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
        }
    }
}

// 2. FUNGSI UPDATE UI DASHBOARD (SUDAH DILINDUNGI DETEKSI HURUF KAPITAL)
function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    let aging = { 'LANCAR': 0, '1-30 H':