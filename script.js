import { getPangkalanBunData, formatRupiah } from './configs.js';

async function syncDashboard() {
    try {
        const data = await getPangkalanBunData();
        if (!data || data.length === 0) return;

        // Fungsi pembantu milikmu (Tetap dipertahankan agar akurat)
        const getVal = (obj, key) => {
            const realKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            return realKey ? Number(obj[realKey]) || 0 : 0;
        };
        const getStr = (obj, key) => {
            const realKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            return realKey ? String(obj[realKey] || '').trim() : '';
        };

        // --- 1. TANGGAL REALTIME (CURRENT) ---
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${now.toLocaleDateString('id-ID', options).toUpperCase()} - ${now.getHours()}.${now.getMinutes()} WIB`;
        document.getElementById('arsip-db-text').innerText = `ARSIP DB: ${now.toLocaleDateString('id-ID')}`;

        // --- 2. KALKULASI DATA UTAMA ---
        const totalOS = data.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);
        const totalOverdue = data.reduce((sum, item) => sum + getVal(item, 'Total_Overdue'), 0);
        const cashData = data.filter(item => getStr(item, 'Metode_Pembayaran').toLowerCase() === 'cash');
        const leasingData = data.filter(item => getStr(item, 'Metode_Pembayaran').toLowerCase() === 'leasing');
        const sumCash = cashData.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);
        const sumLeasing = leasingData.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);

        // Update KPI Utama
        document.getElementById('total-os').innerText = formatRupiah(totalOS);
        document.getElementById('total-overdue').innerText = formatRupiah(totalOverdue);
        document.getElementById('val-cash').innerText = formatRupiah(sumCash);
        document.getElementById('val-leasing').innerText = formatRupiah(sumLeasing);

        // --- 3. DATA AGING ANALYSIS (GRAFIK KANAN ATAS) ---
        let agingMap = { "LANCAR": 0, "1-30 HR": 0, "31-60 HR": 0, ">60 HR": 0 };
        data.forEach(item => {
            const st = getStr(item, 'Lancar').toUpperCase();
            if (st.includes("BELUM") || st.includes("LANCAR")) agingMap["LANCAR"] += getVal(item, 'Os_Balance');
            else if (st.includes("1-30")) agingMap["1-30 HR"] += getVal(item, 'Os_Balance');
            else if (st.includes("31-60")) agingMap["31-60 HR"] += getVal(item, 'Os_Balance');
            else if (st.includes(">60")) agingMap[">60 HR"] += getVal(item, 'Os_Balance');
        });

        // --- 4. TOP 5 SALESMAN (FOOTER) ---
        const salesMap = {};
        data.forEach(item => {
            const sName = getStr(item, 'Salesman') || 'NO NAME';
            salesMap[sName] = (salesMap[sName] || 0) + getVal(item, 'Os_Balance');
        });
        const topSales = Object.entries(salesMap).sort((a,b) => b[1] - a[1]).slice(0,5);
        
        document.getElementById('sales-list').innerHTML = topSales.map(([name, val]) => `
            <div class="flex justify-between items-center text-xs font-bold">
                <span class="text-[#1B2559] uppercase">${name}</span>
                <span class="text-emerald-500">${formatRupiah(val)}</span>
            </div>
        `).join('');

        // --- 5. TOP 5 OVERDUE CUSTOMER (FOOTER) ---
        const overdueCust = data.filter(item => getVal(item, 'Total_Overdue') > 0)
            .sort((a,b) => getVal(b, 'Total_Overdue') - getVal(a, 'Total_Overdue')).slice(0,5);

        document.getElementById('overdue-cust-list').innerHTML = overdueCust.map(item => `
            <div class="flex justify-between gap-2 text-xs font-bold">
                <span class="text-[#1B2559] truncate uppercase">${getStr(item, 'Nama_Customer')}</span>
                <span class="text-red-500">${formatRupiah(getVal(item, 'Total_Overdue'))}</span>
            </div>
        `).join('');

        // Panggil render grafik dengan data asli
        renderCharts(sumCash, sumLeasing, agingMap);

    } catch (err) { console.error("Sync Error:", err); }
}

function renderCharts(cash, leasing, aging) {
    // Render Aging Chart (Kanan Atas)
    new ApexCharts(document.querySelector("#chart-aging-asli"), {
        series: [{ name: 'O/S', data: Object.values(aging) }],
        chart: { type: 'bar', height: 200, toolbar: {show:false} },
        colors: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 4 } },
        xaxis: { categories: Object.keys(aging) },
        dataLabels: { enabled: false }
    }).render();

    // Render Donut (Tengah)
    new ApexCharts(document.querySelector("#chart-donut-pusat"), {
        series: [cash, leasing],
        chart: { type: 'donut', height: 250 },
        labels: ['CASH', 'LEASING'],
        colors: ['#10b981', '#3b82f6'],
        plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: 'TOTAL O/S' } } } } }
    }).render();
}

document.addEventListener('DOMContentLoaded', syncDashboard);