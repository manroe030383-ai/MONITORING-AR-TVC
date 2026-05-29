import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ========================================================
// 1. KONFIGURASI SUPABASE (Lengkap)
// ========================================================
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GXQkaWA5eu4HuiAjptj9UA_gNWY6Q7u'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper untuk format mata uang
const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

// ========================================================
// 2. FUNGSI AMBIL DATA
// ========================================================
async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        
        if (data) {
            updateDashboard(data);
            console.log("Data berhasil dimuat:", data.length, "baris.");
        }
    } catch (e) {
        console.error("Error Fetching:", e);
        const statusEl = document.getElementById('status-update');
        if (statusEl) statusEl.innerText = `KONEKSI GAGAL: ${e.message}`;
    }
}

// ========================================================
// 3. FUNGSI RENDER (Update UI)
// ========================================================
function updateDashboard(data) {
    console.log("Dashboard diupdate dengan data:", data);

    // Tabel Database
    const tbody = document.getElementById('tab-database-body');
    if (tbody) {
        tbody.innerHTML = data.map((d, index) => `
            <tr>
                <td class="p-4 text-center">${index + 1}</td>
                <td class="p-4 font-bold">${d.Customer_Name || '-'}</td>
                <td class="p-4">${d.Leasing_Name || '-'}</td>
                <td class="p-4 text-right">${fmtIDR(d.Os_Balance)}</td>
                <td class="p-4 text-right">${fmtIDR(d.Hari_1_30)}</td>
                <td class="p-4 text-right">${fmtIDR(d.Hari_31_60)}</td>
                <td class="p-4 text-right">${fmtIDR(d.Lebih_60_Hari)}</td>
                <td class="p-4 text-right font-bold text-red-600">${fmtIDR(d.Total_Overdue)}</td>
            </tr>
        `).join('');
    }

    // Card Total O/S
    const totalOS = data.reduce((sum, item) => sum + (Number(item.Os_Balance) || 0), 0);
    const elTotalOS = document.getElementById('total-os');
    if (elTotalOS) elTotalOS.innerText = fmtIDR(totalOS);

    // Card Total Overdue
    const totalOverdue = data.reduce((sum, item) => sum + (Number(item.Total_Overdue) || 0), 0);
    const elTotalOverdue = document.getElementById('total-overdue');
    if (elTotalOverdue) elTotalOverdue.innerText = fmtIDR(totalOverdue);
    
    // Status
    const statusEl = document.getElementById('status-update');
    if (statusEl) {
        statusEl.innerText = `DATA TERBARU: ${data.length} UNIT DIMUAT`;
        statusEl.className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic font-mono";
    }
}

// ========================================================
// 4. INISIALISASI
// ========================================================
document.addEventListener('DOMContentLoaded', fetchData);