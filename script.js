import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Konfigurasi Supabase
const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Fungsi Pembersih Angka
const cleanNum = (val) => Number(String(val).replace(/[^0-9.-]+/g, "")) || 0;

// Fungsi Utama Mengambil Data
async function fetchData() {
    try {
        const { data, error } = await supabase.from('ar_unit').select('*').range(0, 5000);
        if (error) throw error;

        // Jalankan semua proses setelah data didapat
        updateDashboard(data);
        renderTables(data);
        updateExtraComponents(data);
        initAgingChart(data);
        
        console.log("Data dashboard berhasil dimuat sepenuhnya.");
    } catch (e) {
        console.error("Error saat memuat data:", e);
    }
}

// 1. Update Kartu Angka Utama
function updateDashboard(data) {
    let s = { os: 0, ov: 0, penalti: 0, lancar: 0, cash: 0, leas: 0, countCash: 0, countLeas: 0 };

    data.forEach(d => {
        s.os += cleanNum(d.os_balance);
        s.ov += cleanNum(d.total_overdue);
        s.penalti += cleanNum(d.Penalty_Amount);
        s.lancar += cleanNum(d.lancar);

        const leasing = String(d.Leasing_Name || '').toUpperCase();
        if (leasing.includes('CASH') || leasing === '') {
            s.cash += cleanNum(d.os_balance);
            s.countCash++;
        } else {
            s.leas += cleanNum(d.os_balance);
            s.countLeas++;
        }
    });

    document.getElementById('total-os').innerText = 'Rp ' + s.os.toLocaleString('id-ID');
    document.getElementById('total-overdue').innerText = 'Rp ' + s.ov.toLocaleString('id-ID');
    document.getElementById('total-penalty').innerText = 'Rp ' + s.penalti.toLocaleString('id-ID');
    document.getElementById('total-lancar').innerText = 'Rp ' + s.lancar.toLocaleString('id-ID');
    
    document.getElementById('val-total-cash').innerText = 'Rp ' + s.cash.toLocaleString('id-ID');
    document.getElementById('unit-total-cash').innerText = s.countCash + ' Unit';
    document.getElementById('val-total-leas').innerText = 'Rp ' + s.leas.toLocaleString('id-ID');
    document.getElementById('unit-total-leas').innerText = s.countLeas + ' Unit';

    const total = s.os || 1;
    document.getElementById('bar-cash').style.width = ((s.cash / total) * 100) + '%';
    document.getElementById('bar-leasing').style.width = ((s.leas / total) * 100) + '%';
}

// 2. Render Tabel Database
function renderTables(data) {
    const dbBody = document.getElementById('tab-database-body');
    if (!dbBody) return;
    dbBody.innerHTML = data.map((d, i) => `
        <tr>
            <td class="p-4 text-center">${i + 1}</td>
            <td class="p-4 font-bold">${d.Customer_Name}</td>
            <td class="p-4">${d.Leasing_Name}</td>
            <td class="p-4 text-right">${Number(d.os_balance).toLocaleString('id-ID')}</td>
            <td class="p-4 text-right font-bold text-red-600">${Number(d.total_overdue).toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
}

// 3. Update Komponen List (Top Overdue, Sales, TVC)
function updateExtraComponents(data) {
    const topOverdue = [...data].sort((a, b) => cleanNum(b.total_overdue) - cleanNum(a.total_overdue)).slice(0, 5);
    document.getElementById('list-overdue').innerHTML = topOverdue.map(d => `
        <div class="flex justify-between text-[10px] border-b border-slate-50 pb-2">
            <span class="truncate w-1/2 font-bold">${d.Customer_Name}</span>
            <span class="text-red-600 font-bold">Rp ${cleanNum(d.total_overdue).toLocaleString('id-ID')}</span>
        </div>
    `).join('');

    const topSales = [...data].sort((a, b) => cleanNum(b.os_balance) - cleanNum(a.os_balance)).slice(0, 5);
    document.getElementById('list-sales').innerHTML = topSales.map(d => `
        <div class="text-[10px] mb-2">
            <div class="font-bold">${d.Customer_Name}</div>
            <div class="text-slate-400">Rp ${cleanNum(d.os_balance).toLocaleString('id-ID')}</div>
        </div>
    `).join('');

    const tvc = data.filter(d => ['TAFS', 'ACC'].includes(d.Leasing_Name));
    document.getElementById('total-unit-tvc').innerText = tvc.length + ' Unit';
}

// 4. Inisialisasi Grafik
function initAgingChart(data) {
    const aging = { '1-30': 0, '31-60': 0, '>60': 0 };
    data.forEach(d => {
        aging['1-30'] += cleanNum(d.hari_1_30);
        aging['31-60'] += cleanNum(d.hari_31_60);
        aging['>60'] += cleanNum(d.lebih_60_hari);
    });

    const options = {
        series: [aging['1-30'], aging['31-60'], aging['>60']],
        chart: { type: 'bar', height: 250 },
        xaxis: { categories: ['1-30 Hari', '31-60 Hari', '> 60 Hari'] },
        colors: ['#3B82F6', '#F59E0B', '#EF4444']
    };

    const chart = new ApexCharts(document.querySelector("#chart-aging"), options);
    chart.render();
}

// Jalankan saat halaman dimuat
document.addEventListener('DOMContentLoaded', fetchData);