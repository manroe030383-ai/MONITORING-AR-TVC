import { getPangkalanBunData, formatRupiah } from './configs.js';

async function syncDashboard() {
    console.log("Memulai penarikan data dari Supabase...");
    const data = await getPangkalanBunData();

    // Cek jika data kosong
    if (!data || data.length === 0) {
        console.error("Data tidak ditemukan! Pastikan tabel ar_unit sudah berisi baris data.");
        return;
    }

    console.log("Data berhasil diterima:", data);

    // 1. Perhitungan Data Utama (Sesuai nama kolom di Table Editor Anda)
    const totalOS = data.reduce((sum, item) => sum + (Number(item.os_balance) || 0), 0);
    const totalOverdue = data.reduce((sum, item) => sum + (Number(item.total_overdue) || 0), 0);
    const totalLancar = data.reduce((sum, item) => sum + (Number(item.lancar) || 0), 0);
    const totalPenalty = data.reduce((sum, item) => sum + (Number(item.Penalty_Amount) || 0), 0);

    // 2. Filter Berdasarkan Metode_Pembayaran
    const cashData = data.filter(item => String(item.Metode_Pembayaran || '').toLowerCase() === 'cash');
    const leasingData = data.filter(item => String(item.Metode_Pembayaran || '').toLowerCase() === 'leasing');

    const sumCash = cashData.reduce((sum, item) => sum + (Number(item.os_balance) || 0), 0);
    const sumLeasing = leasingData.reduce((sum, item) => sum + (Number(item.os_balance) || 0), 0);

    // 3. Masukkan Angka ke HTML (Dashboard Update)
    document.getElementById('total-os').innerText = formatRupiah(totalOS);
    document.getElementById('total-overdue').innerText = formatRupiah(totalOverdue);
    document.getElementById('total-penalty').innerText = formatRupiah(totalPenalty);
    document.getElementById('total-lancar').innerText = formatRupiah(totalLancar);

    // Update Detail Unit
    const overdueUnits = data.filter(item => (Number(item.total_overdue) || 0) > 0).length;
    document.getElementById('count-overdue').innerText = `${overdueUnits} SPK Lewat TOP`;
    document.getElementById('count-penalty').innerText = `Dari ${overdueUnits} SPK`;

    // Update Komposisi Penjualan
    document.getElementById('val-cash').innerText = formatRupiah(sumCash);
    document.getElementById('val-leasing').innerText = formatRupiah(sumLeasing);
    document.getElementById('unit-cash').innerText = cashData.length;
    document.getElementById('unit-leasing').innerText = leasingData.length;
    document.getElementById('total-all-unit').innerText = `${data.length} Unit`;

    // 4. Update Persentase & Progress Bar
    if (totalOS > 0) {
        const cashPct = (sumCash / totalOS) * 100;
        const leasingPct = 100 - cashPct;

        document.getElementById('pct-cash').innerText = `(${cashPct.toFixed(1)}%)`;
        document.getElementById('pct-leasing').innerText = `(${leasingPct.toFixed(1)}%)`;

        document.getElementById('bar-cash').style.width = `${cashPct}%`;
        document.getElementById('bar-leasing').style.width = `${leasingPct}%`;
    }
}

document.addEventListener('DOMContentLoaded', syncDashboard);