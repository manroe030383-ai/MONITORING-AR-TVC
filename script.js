import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// ========================================================
// 1. KONFIGURASI UTAMA DATABASE SUPABASE AUTO2000
// ========================================================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = { bar: null, donut: null }; 
let cachedData = []; 

// Formatter Mata Uang & Angka
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

// Helper Pengaman Nama Kolom Supabase (Mengantisipasi Spasi & Huruf Besar/Kecil)
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

// ========================================================
// 2. FUNGSI AMBIL DATA LIVE DARI SUPABASE
// ========================================================
async function fetchData() {
    try {
        let query = supabase.from('ar_unit').select('*');
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data) {
            console.log("DATA DARI SUPABASE:", data); 
            
            if (data.length === 0) {
                if (document.getElementById('status-update')) {
                    document.getElementById('status-update').innerText = "KONEKSI SUKSES, TAPI TABEL DI SUPABASE KOSONG (0 DATA)!";
                    document.getElementById('status-update').className = "text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1 italic";
                }
                return;
            }

            cachedData = data; 
            updateDashboard(data);
            
            // Render Status Berhasil di UI
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
            document.