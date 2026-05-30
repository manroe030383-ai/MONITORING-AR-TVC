import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const cleanNum = (val) => Number(String(val).replace(/[^0-9.-]+/g, "")) || 0;

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        if (error) throw error;
        if (data && data.length > 0) {
            updateDashboard(data);
            renderTables(data);
            updateExtraComponents(data);
            initAgingChart(data);
            // Fungsi ini akan mencari ID yang Anda miliki di HTML tanpa menghapus elemen lain
            initDashboardCharts(data); 
            console.log("Dasbor dimuat.");
        }
    } catch (e) { console.error("Error:", e); }
}

// FUNGSI INI HANYA MERENDER GRAFIK DI DALAM ID YANG TERSEDIA
function initDashboardCharts(data) {
    let cashNominal = 0, leasNominal = 0, cashUnit = 0, leasUnit = 0;
    data.forEach(d => {
        const os = cleanNum(d.os_balance);
        const l = String(d.Leasing_Name || '').toUpperCase();
        if (l.includes('CASH') || l === '') { cashNominal += os; cashUnit++; } 
        else { leasNominal += os; leasUnit++; }
    });

    // Cari div yang kosong di bawah teks Total Cash/Leasing di HTML Anda
    const elDonat = document.querySelector("#chart-donat-komposisi");
    if (elDonat) { 
        new ApexCharts(elDonat, { 
            series: [cashUnit, leasUnit], 
            chart: { type: 'donut', height: 150 }, // Ukuran diperkecil agar tidak merusak layout
            labels: ['Cash', 'Leasing'], 
            colors: ['#10B981', '#3B82F6'] 
        }).render(); 
    }
}

// FUNGSI LAINNYA TETAP SEPERTI SEMULA (TIDAK ADA PERUBAHAN STRUKTUR)
function updateDashboard(data) {
    // ... (logic update text tetap sama)
}

document.addEventListener('DOMContentLoaded', fetchData);