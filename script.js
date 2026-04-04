import { getPangkalanBunData, formatRupiah } from './configs.js';

async function syncDashboard() {
    console.log("--- Memulai Sinkronisasi Dashboard Pangkalan Bun ---");
    
    try {
        const data = await getPangkalanBunData();

        // 1. Validasi Data
        if (!data || data.length === 0) {
            console.error("DATA KOSONG! Cek tabel ar_unit di Supabase.");
            return;
        }

        // FUNGSI PEMBANTU: Ambil nilai tanpa peduli huruf besar/kecil kolom
        const getVal = (obj, key) => {
            const realKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            return realKey ? Number(obj[realKey]) || 0 : 0;
        };

        const getStr = (obj, key) => {
            const realKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            return realKey ? String(obj[realKey] || '').toLowerCase() : '';
        };

        // 2. Kalkulasi Data Utama
        const totalOS = data.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);
        const totalOverdue = data.reduce((sum, item) => sum + getVal(item, 'Total_Overdue'), 0);
        const totalPenalty = data.reduce((sum, item) => sum + getVal(item, 'Penalty_Amount'), 0);
        const totalLancar = totalOS - totalOverdue;

        // 3. Filter Metode Pembayaran (Cash vs Leasing)
        const cashData = data.filter(item => getStr(item, 'Metode_Pembayaran') === 'cash');
        const leasingData = data.filter(item => getStr(item, 'Metode_Pembayaran') === 'leasing');

        const sumCash = cashData.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);
        const sumLeasing = leasingData.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);

        // 4. Kalkulasi Aging untuk Bar Chart
        let agingMap = { "LANCAR": 0, "1-30 HR": 0, "31-60 HR": 0, ">60 HR": 0 };
        data.forEach(item => {
            const status = getStr(item, 'Lancar').toUpperCase() || "LANCAR";
            // Normalisasi teks agar cocok dengan map (misal: "> 60 hari" jadi ">60 HR")
            let key = status;
            if (status.includes(">60")) key = ">60 HR";
            if (status.includes("31-60")) key = "31-60 HR";
            if (status.includes("1-30")) key = "1-30 HR";
            
            if (agingMap.hasOwnProperty(key)) {
                agingMap[key] += getVal(item, 'Os_Balance');
            } else {
                agingMap["LANCAR"] += getVal(item, 'Os_Balance');
            }
        });

        // 5. Update Tampilan Teks HTML
        const updateText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        updateText('total-os', formatRupiah(totalOS));
        updateText('total-overdue', formatRupiah(totalOverdue));
        updateText('total-penalty', formatRupiah(totalPenalty));
        updateText('total-lancar', formatRupiah(totalLancar));
        updateText('val-cash', formatRupiah(sumCash));
        updateText('val-leasing', formatRupiah(sumLeasing));
        
        const overdueCount = data.filter(item => getVal(item, 'Total_Overdue') > 0).length;
        updateText('count-overdue', `${overdueCount} SPK Lewat TOP`);

        // 6. Update Progress Bar
        if (totalOS > 0) {
            const cashPct = (sumCash / totalOS) * 100;
            const barCash = document.getElementById('bar-cash');
            const barLeasing = document.getElementById('bar-leasing');
            if (barCash) barCash.style.width = `${cashPct}%`;
            if (barLeasing) barLeasing.style.width = `${100 - cashPct}%`;
        }

        // 7. PANGGIL FUNGSI VISUAL (GRAFIK)
        renderVisuals(sumCash, sumLeasing, agingMap);

        console.log("SINKRONISASI BERHASIL!");

    } catch (err) {
        console.error("Kesalahan Fatal:", err);
    }
}

// FUNGSI UNTUK MENGGAMBAR GRAFIK (ApexCharts)
function renderVisuals(cash, leasing, agingData) {
    // Grafik Donut (Komposisi)
    const donutOptions = {
        series: [cash, leasing],
        chart: { type: 'donut', height: 280 },
        labels: ['CASH', 'LEASING'],
        colors: ['#10b981', '#6366f1'],
        plotOptions: { pie: { donut: { size: '70%' } } },
        dataLabels: { enabled: false },
        legend: { position: 'bottom', fontFamily: 'Plus Jakarta Sans' }
    };
    
    const donutEl = document.querySelector("#donutChart");
    if (donutEl) {
        donutEl.innerHTML = ''; // Bersihkan chart lama
        new ApexCharts(donutEl, donutOptions).render();
    }

    // Grafik Bar (Aging)
    const barOptions = {
        series: [{ name: 'Outstanding', data: Object.values(agingData) }],
        chart: { type: 'bar', height: 280, toolbar: { show: false } },
        plotOptions: { bar: { borderRadius: 8, columnWidth: '50%' } },
        xaxis: { categories: Object.keys(agingData) },
        colors: ['#6366f1'],
        dataLabels: { enabled: false }
    };

    const barEl = document.querySelector("#barAging");
    if (barEl) {
        barEl.innerHTML = ''; // Bersihkan chart lama
        new ApexCharts(barEl, barOptions).render();
    }
}

document.addEventListener('DOMContentLoaded', syncDashboard);