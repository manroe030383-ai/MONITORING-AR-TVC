import { getPangkalanBunData, formatRupiah } from './configs.js';

async function syncDashboard() {
    console.log("--- Memulai Sinkronisasi Dashboard Pangkalan Bun ---");
    
    try {
        // --- 1. UPDATE TANGGAL OTOMATIS (KEKURANGAN POIN 1 & 2) ---
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const dateStr = now.toLocaleDateString('id-ID', options).toUpperCase();
        const timeStr = now.getHours().toString().padStart(2, '0') + "." + now.getMinutes().toString().padStart(2, '0');
        
        const elTglUpdate = document.getElementById('tgl-update-text');
        const elTglArsip = document.getElementById('arsip-db-text');
        
        if (elTglUpdate) elTglUpdate.innerText = `DATA UPDATE: ${dateStr} - ${timeStr} WIB`;
        if (elTglArsip) elTglArsip.innerText = `ARSIP DB: ${now.toLocaleDateString('id-ID')}`;

        const data = await getPangkalanBunData();

        if (!data || data.length === 0) {
            console.error("DATA KOSONG! Cek tabel ar_unit di Supabase.");
            return;
        }

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

        const cashData = data.filter(item => getStr(item, 'Metode_Pembayaran') === 'cash');
        const leasingData = data.filter(item => getStr(item, 'Metode_Pembayaran') === 'leasing');

        const sumCash = cashData.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);
        const sumLeasing = leasingData.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);
        
        // Kalkulasi Unit
        const unitCash = cashData.length;
        const unitLeasing = leasingData.length;

        // 3. Update Tampilan Teks (Sesuaikan dengan ID di HTML)
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
        updateText('unit-cash', unitCash);
        updateText('unit-leasing', unitLeasing);
        updateText('total-all-unit', `${unitCash + unitLeasing} UNIT`);

        // Update Persentase
        if (totalOS > 0) {
            const pctCash = ((sumCash / totalOS) * 100).toFixed(0) + "%";
            const pctLeasing = ((sumLeasing / totalOS) * 100).toFixed(0) + "%";
            updateText('pct-cash', pctCash);
            updateText('pct-leasing', pctLeasing);
            
            const barCash = document.getElementById('bar-cash');
            const barLeasing = document.getElementById('bar-leasing');
            if (barCash) barCash.style.width = pctCash;
            if (barLeasing) barLeasing.style.width = pctLeasing;
        }

        // 4. Kalkulasi Aging (KEKURANGAN POIN 3)
        let agingMap = { "BELUM JT": 0, "1-30 HR": 0, "31-60 HR": 0, ">60 HR": 0 };
        data.forEach(item => {
            const status = getStr(item, 'Lancar').toUpperCase();
            if (status.includes("BELUM") || status.includes("LANCAR")) agingMap["BELUM JT"] += getVal(item, 'Os_Balance');
            else if (status.includes("1-30")) agingMap["1-30 HR"] += getVal(item, 'Os_Balance');
            else if (status.includes("31-60")) agingMap["31-60 HR"] += getVal(item, 'Os_Balance');
            else if (status.includes(">60")) agingMap[">60 HR"] += getVal(item, 'Os_Balance');
        });

        // 5. Panggil Fungsi Visual (KEKURANGAN POIN 4)
        renderVisuals(sumCash, sumLeasing, agingMap);

        console.log("SINKRONISASI BERHASIL!");

    } catch (err) {
        console.error("Kesalahan Fatal:", err);
    }
}

function renderVisuals(cash, leasing, agingData) {
    // Grafik Donut (Komposisi) - ID disesuaikan: #chart-donut-komposisi
    const donutEl = document.querySelector("#chart-donut-komposisi");
    if (donutEl) {
        donutEl.innerHTML = ''; 
        const donutOptions = {
            series: [cash, leasing],
            chart: { type: 'donut', height: 220 },
            labels: ['CASH', 'LEASING'],
            colors: ['#10b981', '#3b82f6'],
            plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'COMP' } } } } },
            dataLabels: { enabled: false },
            legend: { show: false }
        };
        new ApexCharts(donutEl, donutOptions).render();
    }

    // Grafik Bar (Aging Mini di Card Potensi Penalti)
    const barEl = document.querySelector("#chart-aging-mini");
    if (barEl) {
        barEl.innerHTML = '';
        const barOptions = {
            series: [{ name: 'O/S', data: Object.values(agingData) }],
            chart: { type: 'bar', height: 80, sparkline: { enabled: true } },
            colors: ['#3b82f6'],
            plotOptions: { bar: { borderRadius: 2, columnWidth: '60%' } },
            tooltip: { fixed: { enabled: false } }
        };
        new ApexCharts(barEl, barOptions).render();
    }
}

document.addEventListener('DOMContentLoaded', syncDashboard);