import { getPangkalanBunData, formatRupiah } from './configs.js';

// Variabel global untuk menyimpan instance chart agar bisa di-update/destroy
let agingChart, donutChart;

async function syncDashboard() {
    try {
        const data = await getPangkalanBunData();
        if (!data || data.length === 0) return;

        const getVal = (obj, key) => {
            const realKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            return realKey ? Number(obj[realKey]) || 0 : 0;
        };
        const getStr = (obj, key) => {
            const realKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            return realKey ? String(obj[realKey] || '').trim() : '';
        };

        // --- 1. TANGGAL & HEADER ---
        const now = new Date();
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${now.toLocaleDateString('id-ID', options).toUpperCase()} - ${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')} WIB`;
        document.getElementById('arsip-db-text').innerText = `ARSIP DB: ${now.toLocaleDateString('id-ID')}`;

        // --- 2. KALKULASI KPI ---
        const totalOS = data.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);
        const totalOverdue = data.reduce((sum, item) => sum + getVal(item, 'Total_Overdue'), 0);
        const sumCash = data.filter(item => getStr(item, 'Metode_Pembayaran').toLowerCase() === 'cash')
                            .reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);
        const sumLeasing = data.filter(item => getStr(item, 'Metode_Pembayaran').toLowerCase() === 'leasing')
                               .reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);

        document.getElementById('total-os').innerText = formatRupiah(totalOS);
        document.getElementById('total-overdue').innerText = formatRupiah(totalOverdue);
        document.getElementById('val-cash').innerText = formatRupiah(sumCash);
        document.getElementById('val-leasing').innerText = formatRupiah(sumLeasing);

        // --- 3. AGING ANALYSIS ---
        let agingMap = { "LANCAR": 0, "1-30 HR": 0, "31-60 HR": 0, ">60 HR": 0 };
        data.forEach(item => {
            const st = getStr(item, 'Lancar').toUpperCase();
            const val = getVal(item, 'Os_Balance');
            if (st.includes("BELUM") || st.includes("LANCAR")) agingMap["LANCAR"] += val;
            else if (st.includes("1-30")) agingMap["1-30 HR"] += val;
            else if (st.includes("31-60")) agingMap["31-60 HR"] += val;
            else if (st.includes(">60")) agingMap[">60 HR"] += val;
        });

        // --- 4. TOP 5 SALESMAN ---
        const salesMap = {};
        data.forEach(item => {
            const sName = getStr(item, 'Salesman') || 'TANPA NAMA';
            salesMap[sName] = (salesMap[sName] || 0) + getVal(item, 'Os_Balance');
        });
        const topSales = Object.entries(salesMap).sort((a,b) => b[1] - a[1]).slice(0,5);
        
        document.getElementById('sales-list').innerHTML = topSales.map(([name, val]) => `
            <div class="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                <span class="text-[#1B2559] text-[10px] font-bold uppercase truncate mr-2">${name}</span>
                <span class="text-emerald-500 text-[10px] font-black whitespace-nowrap">${formatRupiah(val)}</span>
            </div>
        `).join('');

        // --- 5. TOP 5 OVERDUE ---
        const overdueCust = data.filter(item => getVal(item, 'Total_Overdue') > 0)
            .sort((a,b) => getVal(b, 'Total_Overdue') - getVal(a, 'Total_Overdue')).slice(0,5);

        document.getElementById('overdue-cust-list').innerHTML = overdueCust.map(item => `
            <div class="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                <span class="text-[#1B2559] text-[10px] font-bold uppercase truncate mr-2">${getStr(item, 'Nama_Customer')}</span>
                <span class="text-red-500 text-[10px] font-black">${formatRupiah(getVal(item, 'Total_Overdue'))}</span>
            </div>
        `).join('');

        renderCharts(sumCash, sumLeasing, agingMap);

    } catch (err) { console.error("Sync Error:", err); }
}

function renderCharts(cash, leasing, aging) {
    // Hapus chart lama jika sudah ada (mencegah penumpukan visual)
    if(agingChart) agingChart.destroy();
    if(donutChart) donutChart.destroy();

    // Aging Chart
    agingChart = new ApexCharts(document.querySelector("#chart-aging-asli"), {
        series: [{ name: 'O/S', data: Object.values(aging) }],
        chart: { type: 'bar', height: 200, toolbar: {show:false} },
        colors: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
        plotOptions: { bar: { distributed: true, borderRadius: 6, columnWidth: '60%' } },
        xaxis: { categories: Object.keys(aging), labels: { style: { fontSize: '9px', fontWeight: 700 } } },
        yaxis: { labels: { show: false } },
        dataLabels: { enabled: false },
        tooltip: { y: { formatter: (val) => formatRupiah(val) } }
    });
    agingChart.render();

    // Donut Chart
    donutChart = new ApexCharts(document.querySelector("#chart-donut-pusat"), {
        series: [cash, leasing],
        chart: { type: 'donut', height: 250 },
        labels: ['CASH', 'LEASING'],
        colors: ['#10b981', '#3b82f6'],
        stroke: { show: false },
        plotOptions: { pie: { donut: { size: '75%', labels: { show: true, total: { show: true, label: 'TOTAL O/S', fontSize: '10px', formatter: () => formatRupiah(cash + leasing) } } } } },
        legend: { position: 'bottom', fontSize: '10px', fontWeight: 700 }
    });
    donutChart.render();
}

// Jalankan sync saat tombol ditekan (jika ada) atau saat load
document.addEventListener('DOMContentLoaded', syncDashboard);