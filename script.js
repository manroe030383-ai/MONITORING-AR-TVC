import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Konfigurasi
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GXQkaWA5eu4HuiAjptj9UA_gNWY6Q7u'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data) {
            console.log("Data diterima:", data[0]); // Untuk melihat format kolom asli
            updateDashboard(data);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

function updateDashboard(data) {
    // Fungsi bantuan untuk mencari nilai kolom tidak peduli besar/kecil huruf
    const val = (obj, key) => {
        const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
        return obj[foundKey] || 0;
    };

    // 1. Update Tabel
    const tbody = document.getElementById('tab-database-body');
    if (tbody) {
        tbody.innerHTML = data.map((d, index) => `
            <tr>
                <td class="p-4 text-center">${index + 1}</td>
                <td class="p-4 font-bold">${val(d, 'Customer_Name') || '-'}</td>
                <td class="p-4">${val(d, 'Leasing_Name') || '-'}</td>
                <td class="p-4 text-right">${fmtIDR(val(d, 'Os_Balance'))}</td>
                <td class="p-4 text-right">${fmtIDR(val(d, 'Hari_1_30'))}</td>
                <td class="p-4 text-right">${fmtIDR(val(d, 'Hari_31_60'))}</td>
                <td class="p-4 text-right">${fmtIDR(val(d, 'Lebih_60_Hari'))}</td>
                <td class="p-4 text-right font-bold text-red-600">${fmtIDR(val(d, 'Total_Overdue'))}</td>
            </tr>
        `).join('');
    }

    // 2. Update Total O/S Balance
    const totalOS = data.reduce((sum, item) => sum + (Number(val(item, 'Os_Balance')) || 0), 0);
    document.getElementById('total-os').innerText = fmtIDR(totalOS);

    // 3. Update Total Overdue
    const totalOverdue = data.reduce((sum, item) => sum + (Number(val(item, 'Total_Overdue')) || 0), 0);
    document.getElementById('total-overdue').innerText = fmtIDR(totalOverdue);

    // 4. Update Status
    document.getElementById('status-update').innerText = `DATA TERBARU: ${data.length} UNIT DIMUAT`;
}

document.addEventListener('DOMContentLoaded', fetchData);