import { getPangkalanBunData, formatRupiah } from './configs.js';

async function syncDashboard() {
    console.log("--- Memulai Sinkronisasi Dashboard ---");
    
    try {
        const data = await getPangkalanBunData();

        // 1. Cek Koneksi & Isi Data
        if (!data || data.length === 0) {
            console.error("DATA KOSONG! Cek 2 hal: 1. Apakah tabel ar_unit ada isinya? 2. Apakah RLS Policy sudah 'true'?");
            alert("Data dari Supabase kosong. Pastikan RLS Policy sudah Aktif!");
            return;
        }

        console.log("Data diterima dari Supabase:", data);

        // FUNGSI PEMBANTU: Mencari kolom tanpa peduli huruf besar/kecil (Pangkalan Bun Standard)
        const getVal = (obj, key) => {
            const realKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            const val = realKey ? obj[realKey] : 0;
            return Number(val) || 0;
        };

        const getStr = (obj, key) => {
            const realKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
            return realKey ? String(obj[realKey] || '').toLowerCase() : '';
        };

        // 2. Kalkulasi Data (Menghitung baris per baris)
        const totalOS = data.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);
        const totalOverdue = data.reduce((sum, item) => sum + getVal(item, 'Total_Overdue'), 0);
        const totalLancar = data.reduce((sum, item) => sum + getVal(item, 'Lancar'), 0);
        const totalPenalty = data.reduce((sum, item) => sum + getVal(item, 'Penalty_Amount'), 0);

        // 3. Filter Metode Pembayaran
        const cashData = data.filter(item => getStr(item, 'Metode_Pembayaran') === 'cash');
        const leasingData = data.filter(item => getStr(item, 'Metode_Pembayaran') === 'leasing');

        const sumCash = cashData.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);
        const sumLeasing = leasingData.reduce((sum, item) => sum + getVal(item, 'Os_Balance'), 0);

        // 4. Update Tampilan HTML (Gunakan ID yang ada di admin.html)
        const updateText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.innerText = val;
        };

        updateText('total-os', formatRupiah(totalOS));
        updateText('total-overdue', formatRupiah(totalOverdue));
        updateText('total-penalty', formatRupiah(totalPenalty));
        updateText('total-lancar', formatRupiah(totalLancar));

        // 5. Update Detail & Unit
        const overdueCount = data.filter(item => getVal(item, 'Total_Overdue') > 0).length;
        updateText('count-overdue', `${overdueCount} SPK Lewat TOP`);
        updateText('count-penalty', `Dari ${overdueCount} SPK`);
        updateText('val-cash', formatRupiah(sumCash));
        updateText('val-leasing', formatRupiah(sumLeasing));
        updateText('unit-cash', cashData.length);
        updateText('unit-leasing', leasingData.length);
        updateText('total-all-unit', `${data.length} Unit`);

        // 6. Update Progress Bar
        if (totalOS > 0) {
            const cashPct = (sumCash / totalOS) * 100;
            const barCash = document.getElementById('bar-cash');
            const barLeasing = document.getElementById('bar-leasing');
            if (barCash) barCash.style.width = `${cashPct}%`;
            if (barLeasing) barLeasing.style.width = `${100 - cashPct}%`;
            
            updateText('pct-cash', `${cashPct.toFixed(1)}%`);
            updateText('pct-leasing', `${(100 - cashPct).toFixed(1)}%`);
        }

        console.log("SINKRONISASI BERHASIL!");

    } catch (err) {
        console.error("Terjadi Kesalahan Fatal:", err);
    }
}

document.addEventListener('DOMContentLoaded', syncDashboard);