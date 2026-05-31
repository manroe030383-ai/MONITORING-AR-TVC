import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient(
    'https://ozcrikgzsadezarhccvp.supabase.co', 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8'
);

// Fungsi pembantu untuk membersihkan format angka
const cleanNum = (v) => Number(String(v || 0).replace(/[^0-9.-]+/g, "")) || 0;

async function fetchData() {
    const { data, error } = await supabase.from('ar_unit').select('*');
    if (error) { console.error("Error Fetching:", error); return; }

    if (data) {
        // --- 1. Kalkulasi Data ---
        let totals = { 
            os: 0, ov: 0, cash: 0, leas: 0, 
            unitCash: 0, unitLeas: 0, 
            h1_30: 0, h31_60: 0, h60: 0 
        };
        
        data.forEach(d => {
            let os = cleanNum(d.os_balance);
            let ov = cleanNum(d.total_overdue);
            
            totals.os += os;
            totals.ov += ov;
            totals.h1_30 += cleanNum(d.h1_30);
            totals.h31_60 += cleanNum(d.h31_60);
            totals.h60 += cleanNum(d.h60_plus);
            
            const l = String(d.Leasing_Name || '').toUpperCase();
            if (l.includes('CASH')) { totals.cash += os; totals.unitCash++; } 
            else { totals.leas += os; totals.unitLeas++; }
        });

        // --- 2. Update Header & Dashboard Atas ---
        document.getElementById('status-update').innerText = "TERAKHIR DIPERBARUI: " + new Date().toLocaleTimeString('id-ID');
        document.getElementById('tgl-arsip').innerText = "31/5/2026";
        document.getElementById('total-os').innerText = 'Rp ' + totals.os.toLocaleString('id-ID');
        document.getElementById('total-overdue').innerText = 'Rp ' + totals.ov.toLocaleString('id-ID');
        document.getElementById('badge-overdue').innerText = data.filter(d => cleanNum(d.total_overdue) > 0).length + " SPK LEWAT TOP";
        
        // Progress Bar
        document.getElementById('bar-cash').style.width = ((totals.cash / (totals.os || 1)) * 100) + '%';
        document.getElementById('bar-leasing').style.width = ((totals.leas / (totals.os || 1)) * 100) + '%';

        // Breakdown Penjualan
        document.getElementById('val-total-cash').innerText = 'Rp ' + totals.cash.toLocaleString('id-ID');
        document.getElementById('unit-total-cash').innerText = totals.unitCash + ' Unit';
        document.getElementById('val-total-leas').innerText = 'Rp ' + totals.leas.toLocaleString('id-ID');
        document.getElementById('unit-total-leas').innerText = totals.unitLeas + ' Unit';

        // --- 3. Render Grafik (Reset Container Terlebih Dahulu) ---
        document.querySelector("#chart-aging").innerHTML = "";
        document.querySelector("#chart-donut-leasing").innerHTML = "";

        new ApexCharts(document.querySelector("#chart-aging"), {
            series: [{ name: 'Nominal', data: [totals.h1_30, totals.h31_60, totals.h60] }],
            chart: { type: 'bar', height: 200, toolbar: { show: false } },
            xaxis: { categories: ['1-30 Hari', '31-60 Hari', '>60 Hari'] },
            colors: ['#EF4444']
        }).render();

        new ApexCharts(document.querySelector("#chart-donut-leasing"), {
            series: [totals.cash, totals.leas],
            chart: { type: 'donut', height: 180 },
            labels: ['Cash', 'Leasing'],
            colors: ['#10B981', '#2563EB'],
            legend: { show: false }
        }).render();

        // --- 4. Render Tabel & Lists ---
        const sortedOverdue = [...data]
            .filter(d => cleanNum(d.total_overdue) > 0)
            .sort((a,b) => cleanNum(b.total_overdue) - cleanNum(a.total_overdue))
            .slice(0, 5);

        document.getElementById('list-overdue').innerHTML = sortedOverdue.map(d => `
            <div class="flex justify-between text-[10px] mb-2">
                <span class="font-bold text-slate-700 truncate w-32">${d.Customer_Name}</span>
                <span class="text-red-600 font-black">Rp ${cleanNum(d.total_overdue).toLocaleString('id-ID')}</span>
            </div>
        `).join('');

        document.getElementById('tab-database-body').innerHTML = data.map((d, i) => `
            <tr class="hover:bg-slate-50 border-b border-slate-50">
                <td class="p-4 text-center">${i + 1}</td>
                <td class="p-4 font-bold text-slate-700">${d.Customer_Name}</td>
                <td class="p-4">${d.Leasing_Name}</td>
                <td class="p-4 text-right">Rp ${cleanNum(d.os_balance).toLocaleString('id-ID')}</td>
                <td class="p-4 text-right">${d.h1_30 || 0}</td>
                <td class="p-4 text-right">${d.h31_60 || 0}</td>
                <td class="p-4 text-right">${d.h60_plus || 0}</td>
                <td class="p-4 text-right font-bold text-red-600">Rp ${cleanNum(d.total_overdue).toLocaleString('id-ID')}</td>
            </tr>
        `).join('');
    }
}

// Inisialisasi saat halaman dimuat
document.addEventListener('DOMContentLoaded', fetchData);