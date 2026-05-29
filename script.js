import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// ========================================================
// 1. KONFIGURASI SUPABASE (Gunakan URL bersih & ANON KEY)
// ========================================================
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
// Ganti dengan anon key Anda (bukan service_role!)
const SUPABASE_KEY = 'sb_publishable_GXQkaWA5eu4HuiAjptj9UA_gNWY6Q7u'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = { bar: null, donut: null }; 
let cachedData = []; 

const urlPath = window.location.pathname.toLowerCase();
const isTafsPage = urlPath.includes('tafs');
const isAccPage = urlPath.includes('acc');

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

// ========================================================
// 2. FUNGSI AMBIL DATA
// ========================================================
async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        
        if (error) throw error;
        
        if (data) {
            let finalFilteredData = data;
            
            // Filter Berdasarkan URL
            if (isTafsPage) {
                finalFilteredData = data.filter(d => 
                    String(getProp(d, 'Chas/Leasing') || '').toUpperCase().includes('TAFS')
                );
            } else if (isAccPage) {
                finalFilteredData = data.filter(d => 
                    String(getProp(d, 'Chas/Leasing') || '').toUpperCase().includes('ACC')
                );
            }

            cachedData = finalFilteredData; 
            updateDashboard(finalFilteredData);
            
            console.log("Data berhasil dimuat:", finalFilteredData.length, "baris.");
        }
    } catch (e) {
        console.error("Error Fetching:", e);
        if (document.getElementById('status-update')) {
            document.getElementById('status-update').innerText = `KONEKSI GAGAL: ${e.message}`;
            document.getElementById('status-update').className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
        }
    }
}

// ========================================================
// 3. FUNGSI RENDER (Sisa logika fungsi lainnya tetap sama)
// ========================================================
function updateDashboard(data) {
    // ... [Logika proses data Anda tetap di sini] ...
    console.log("Dashboard diupdate...");
}

// ========================================================
// 4. INISIALISASI
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Panggil fetch awal
    fetchData();
    
    // Real-time listener
    supabase
        .channel('ar_unit_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ar_unit' }, (payload) => {
            console.log('Update terdeteksi, merefresh data...');
            fetchData(); 
        })
        .subscribe();
});