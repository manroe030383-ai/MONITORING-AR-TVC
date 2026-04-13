import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi Supabase
const supabaseUrl = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'
const supabase = createClient(supabaseUrl, supabaseKey)

// Inisialisasi Chart sebagai variabel global agar bisa diupdate
let chartAging, chartDonut;

// 2. Fungsi Utama Ambil Data
async function loadDashboardData() {
    try {
        const { data: arData, error } = await supabase
            .from('ar_unit')
            .select('*');

        if (error) throw error;

        // Proses perhitungan data
        processData(arData);
        
    } catch (err) {
        console.error("Gagal mengambil data:", err.message);
    }
}

// 3. Logika Perhitungan Dashboard
function processData(data) {
    let totalOS = 0, totalLancar = 0, totalOverdue = 0, totalPenalty = 0;
    let cashNominal = 0, leasingNominal = 0, cashUnit = 0, leasingUnit = 0;
    
    // Kategori Aging
    let aging = { lancar: 0, h1_30: 0, h31_60: 0, over60: 0 };

    data.forEach(item => {
        const nominal = parseFloat(item.os_balance) || 0;
        totalOS += nominal;

        // Hitung Cash vs Leasing (Berdasarkan kolom payment_type / sejenisnya di tabel Anda)
        if (item.leasing_name === 'CASH') {
            cashNominal += nominal;
            cashUnit++;
        } else {
            leasingNominal += nominal;
            leasingUnit++;
        }

        // Klasifikasi Aging (Gunakan kolom status_aging Anda)
        if (item.status_aging === 'Lancar') {
            totalLancar += nominal;
            aging.lancar += nominal;
        } else {
            totalOverdue += nominal;
            if (item.status_aging === '1-30 HR') aging.h1_30 += nominal;
            else if (item.status_aging === '31-60 HR') aging.h31_60 += nominal;
            else aging.over60 += nominal;
        }
        
        totalPenalty += parseFloat(item.penalty_amount) || 0;
    });

    updateUI(totalOS, totalOverdue, totalPenalty, totalLancar, cashNominal, leasingNominal, cashUnit, leasingUnit);
    renderCharts(aging, [cashNominal, leasingNominal]);
    updateSalesmanList(data);
}

// 4. Update Angka di HTML
function updateUI(os, overdue, penalty, lancar, cNom, lNom, cUnit, lUnit) {
    const fmt = (v) => "Rp " + v.toLocaleString('id-ID');
    
    document.getElementById('total-os').innerText = fmt(os);
    document.getElementById('total-overdue').innerText = fmt(overdue);
    document.getElementById('total-penalty').innerText = fmt(penalty);
    document.getElementById('total-lancar').innerText = fmt(lancar);
    
    document.getElementById('val-total-cash').innerText = fmt(cNom);
    document.getElementById('val-total-leasing').innerText = fmt(lNom);
    document.getElementById('unit-cash').innerText = cUnit + " Unit";
    document.getElementById('unit-leasing').innerText = lUnit + " Unit";

    // Update Progress Bar O/S
    const total = cNom + lNom;
    const pCash = (cNom / total * 100) || 0;
    document.getElementById('bar-cash').style.width = pCash + "%";
    document.getElementById('bar-leasing').style.width = (100 - pCash) + "%";
}

// 5. Render Grafik (Pastikan ID sesuai HTML)
function renderCharts(aging, donutSeries) {
    // Bersihkan chart lama jika ada agar tidak tumpang tindih
    if (chartAging) chartAging.destroy();
    if (chartDonut) chartDonut.destroy();

    chartAging = new ApexCharts(document.querySelector("#chart-aging-nominal"), {
        series: [{ name: 'Nominal', data: [aging.lancar, aging.h1_30, aging.h31_60, aging.over60] }],
        chart: { type: 'bar', height: 250, toolbar: {show: false} },
        colors: ['#10B981', '#FBBF24', '#F97316', '#EF4444'],
        plotOptions: { bar: { borderRadius: 6, columnWidth: '45%' } },
        xaxis: { categories: ['LANCAR', '1-30 HR', '31-60 HR', '>60 HR'] }
    });
    chartAging.render();

    chartDonut = new ApexCharts(document.querySelector("#chart-donut-main"), {
        series: donutSeries,
        chart: { type: 'donut', height: 250 },
        labels: ['CASH', 'LEASING'],
        colors: ['#10B981', '#2563EB'],
        legend: { position: 'bottom' }
    });
    chartDonut.render();
}

// 6. Update List Salesman (Top 5)
function updateSalesmanList(data) {
    const list = document.getElementById('list-salesman');
    list.innerHTML = ""; // Bersihkan list lama

    // Logika pengelompokan per salesman
    const salesData = data.reduce((acc, curr) => {
        acc[curr.salesman] = (acc[curr.salesman] || 0) + (parseFloat(curr.os_balance) || 0);
        return acc;
    }, {});

    Object.entries(salesData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([name, val], i) => {
            list.innerHTML += `
                <div class="flex justify-between items-center text-[10px]">
                    <span class="font-bold text-slate-600">${i+1}. ${name}</span>
                    <span class="font-black text-red-600">${(val/1000000).toFixed(1)} Jt</span>
                </div>`;
        });
}

// 7. REALTIME SUBSCRIBE (Dashboard otomatis update saat data Supabase berubah)
supabase
    .channel('public:ar_unit')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ar_unit' }, () => {
        loadDashboardData();
    })
    .subscribe();

// Jalankan saat pertama load
loadDashboardData();