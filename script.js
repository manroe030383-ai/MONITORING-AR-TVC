import { getPangkalanBunData, formatRupiah } from './configs.js';

async function syncDashboard() {
    // Beri efek loading pada angka agar user tahu data sedang ditarik
    const elements = ['total-os', 'total-overdue', 'total-penalty', 'total-lancar'];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = "Loading...";
    });

    try {
        const data = await getPangkalanBunData();

        if (!data || data.length === 0) {
            console.error("Data kosong atau RLS belum aktif.");
            return;
        }

        console.log("Data diterima:", data);

        // LOGIKA PERHITUNGAN (Mengantisipasi huruf besar/kecil di Supabase)
        const totalOS = data.reduce((sum, item) => sum + (Number(item.Os_Balance || item.os_balance || 0)), 0);
        const totalOverdue = data.reduce((sum, item) => sum + (Number(item.Total_Overdue || item.total_overdue || 0)), 0);
        const totalLancar = data.reduce((sum, item) => sum + (Number(item.Lancar || item.lancar || 0)), 0);
        const totalPenalty = data.reduce((sum, item) => sum + (Number(item.Penalty_Amount || item.penalty_amount || 0)), 0);

        // FILTER METODE PEMBAYARAN
        const cashData = data.filter(item => String(item.Metode_Pembayaran || item.metode_pembayaran || '').toLowerCase() === 'cash');
        const leasingData = data.filter(item => String(item.Metode_Pembayaran || item.metode_pembayaran || '').toLowerCase() === 'leasing');

        const sumCash = cashData.reduce((sum, item) => sum + (Number(item.Os_Balance || item.os_balance || 0)), 0);
        const sumLeasing = leasingData.reduce((sum, item) => sum + (Number(item.Os_Balance || item.os_balance || 0)), 0);

        // UPDATE UI
        document.getElementById('total-os').innerText = formatRupiah(totalOS);
        document.getElementById('total-overdue').innerText = formatRupiah(totalOverdue);
        document.getElementById('total-penalty').innerText = formatRupiah(totalPenalty);
        document.getElementById('total-lancar').innerText = formatRupiah(totalLancar);

        const overdueCount = data.filter(item => (Number(item.Total_Overdue || item.total_overdue || 0)) > 0).length;
        document.getElementById('count-overdue').innerText = `${overdueCount} SPK Lewat TOP`;
        document.getElementById('count-penalty').innerText = `Dari ${overdueCount} SPK`;

        document.getElementById('val-cash').innerText = formatRupiah(sumCash);
        document.getElementById('val-leasing').innerText = formatRupiah(sumLeasing);
        document.getElementById('unit-cash').innerText = cashData.length;
        document.getElementById('unit-leasing').innerText = leasingData.length;
        document.getElementById('total-all-unit').innerText = `${data.length} Unit`;

        // UPDATE PROGRESS BAR & PERCENTAGE
        if (totalOS > 0) {
            const cashPct = (sumCash / totalOS) * 100;
            const leasingPct = 100 - cashPct;

            document.getElementById('pct-cash').innerText = `${cashPct.toFixed(1)}%`;
            document.getElementById('pct-leasing').innerText = `${leasingPct.toFixed(1)}%`;
            document.getElementById('bar-cash').style.width = `${cashPct}%`;
            document.getElementById('bar-leasing').style.width = `${leasingPct}%`;
        }

    } catch (error) {
        console.error("Gagal sinkronisasi:", error);
    }
}

// Jalankan saat load pertama
document.addEventListener('DOMContentLoaded', () => {
    syncDashboard();

    // Jalankan saat tombol sync diklik
    const btnSync = document.getElementById('btn-sync');
    if (btnSync) {
        btnSync.addEventListener('click', syncDashboard);
    }
});