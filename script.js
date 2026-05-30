import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Perbaikan URL: Pastikan URL menggunakan format https://[project-id].supabase.co
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const cleanNum = (val) => Number(String(val).replace(/[^0-9.-]+/g, "")) || 0;

async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*').range(0, 5000);
        if (error) throw error;

        const d = data || [];
        updateDashboard(d);
        renderTables(d);
        updateExtraComponents(d);
        initAgingChart(d);
        initDashboardCharts(d); // Memanggil grafik baru
        
        console.log("Data dashboard berhasil dimuat.");
    } catch (e) {
        console.error("Error:", e);
    }
}

// Fungsi Grafik Baru (Donat & Batang)
function initDashboardCharts(data) {
    let cashNominal = 0, leasNominal = 0;
    let cashUnit = 0, leasUnit = 0;

    data.forEach(d => {
        const os = cleanNum(d.os_balance);
        const leasing = String(d.Leasing_Name || '').toUpperCase();
        if (leasing.includes('CASH') || leasing === '') {
            cashNominal += os;
            cashUnit++;
        } else {
            leasNominal += os;
            leasUnit++;
        }
    });

    // 1. Grafik Donat (Komposisi Unit)
    const optionsDonat = {
        series: [cashUnit, leasUnit],
        chart: { type: 'donut', height: 250 },
        labels: ['Cash', 'Leasing'],
        colors: ['#10B981', '#3B82F6']
    };
    new ApexCharts(document.querySelector("#chart-donat-komposisi"), optionsDonat).render();

    // 2. Grafik Batang (Perbandingan Nominal)
    const optionsBatang = {
        series: [{ name: 'Nominal (Rp)', data: [cashNominal, leasNominal] }],
        chart: { type: 'bar', height: 250 },
        xaxis: { categories: ['Cash', 'Leasing'] },
        yaxis: { labels: { formatter: (val) => (val / 1000000000).toFixed(1) + ' M' } },
        colors: ['#10B981', '#3B82F6']
    };
    new ApexCharts(document.querySelector("#chart-batang-nominal"), optionsBatang).render();
}

// ... (Simpan fungsi updateDashboard, renderTables, updateExtraComponents, initAgingChart dari kode Anda sebelumnya di bawah ini)