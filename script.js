import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient('https://ozcrikgzsadezarhccvp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8');

const cleanNum = (v) => Number(String(v).replace(/[^0-9.-]+/g, "")) || 0;

async function fetchData() {
    const { data, error } = await supabase.from('ar_unit').select('*');
    if (error) { console.error("Error:", error); return; }

    if (data) {
        // 1. Kalkulasi Data
        let totals = { h1_30: 0, h31_60: 0, h60: 0, cash: 0, leas: 0 };
        data.forEach(d => {
            totals.h1_30 += cleanNum(d.h1_30);
            totals.h31_60 += cleanNum(d.h31_60);
            totals.h60 += cleanNum(d.h60_plus);
            
            const l = String(d.Leasing_Name || '').toUpperCase();
            if (l.includes('CASH')) totals.cash += cleanNum(d.os_balance);
            else totals.leas += cleanNum(d.os_balance);
        });

        // 2. Grafik Aging Analysis (Bar Chart)
        new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Nominal', data: [totals.h1_30, totals.h31_60, totals.h60] }],
            chart: { type: 'bar', height: 250, toolbar: { show: false } },
            plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '50%' } },
            xaxis: { categories: ['1-30 Hari', '31-60 Hari', '>60 Hari'] },
            colors: ['#EF4444']
        }).render();

        // 3. Grafik Komposisi Leasing (Donut Chart)
        new ApexCharts(document.querySelector("#chart-donut-leasing"), {
            series: [totals.cash, totals.leas],
            chart: { type: 'donut', height: 200 },
            labels: ['Cash', 'Leasing'],
            colors: ['#10B981', '#2563EB'],
            dataLabels: { enabled: false },
            legend: { show: false }
        }).render();

        // --- Sisanya tetap seperti fungsi sebelumnya ---
        document.getElementById('status-update').innerText = "TERAKHIR DIPERBARUI: " + new Date().toLocaleTimeString('id-ID');
        document.getElementById('total-os').innerText = 'Rp ' + (totals.cash + totals.leas).toLocaleString('id-ID');
        
        // Render tabel dan list lainnya...
        // (Pastikan fungsi rendering tabel tetap ada di sini)
    }
}

document.addEventListener('DOMContentLoaded', fetchData);