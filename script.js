function processDashboard(data) {
    // 1. Inisialisasi hitungan (Wajib Reset ke 0)
    let totalOS = 0, totalOverdueNominal = 0, totalPenalty = 0;
    let totalLancarNominal = 0;
    let cashNominal = 0, leasingNominal = 0;
    let cashUnit = 0, leasingUnit = 0; 
    
    // Variabel rincian TVC (Target 29 Unit Jatuh Tempo)
    let unitACC = 0, unitTAFS = 0, unitSudahGI = 0, unitRDelivery = 0;

    // Objek untuk grafik aging analysis
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        // --- PROTEKSI DATA KOSONG ---
        // Jika baris kosong, lompati ke baris berikutnya, JANGAN hentikan fungsi
        if (!d.customer_name && !d.leasing_name) return; 

        // Ambil nilai dari kolom database (Sesuai image_60a72d & image_620f4b)
        const os = Number(d.os_balance) || 0;
        const overdueDays = Number(d.hari_overdue) || 0;
        const overdueNominal = Number(d.total_overdue) || Number(d.total_overd) || 0;
        const penaltyAmount = Number(d.penalty_amount) || 0;
        
        const vLancar = Number(d.lancar) || 0;
        const v1_30 = Number(d.hari_1_30) || 0;
        const v31_60 = Number(d.hari_31_60) || 0;
        const vOver60 = Number(d.lebih_60_hari) || 0;

        const leasingName = (d.leasing_name || '').toUpperCase().trim();
        const funcLoc = (d.func_loc || '').toUpperCase().trim();

        // 2. Akumulasi Finansial (Agar tidak muncul Rp 0)
        totalOS += os;
        totalOverdueNominal += overdueNominal;
        totalPenalty += penaltyAmount;
        totalLancarNominal += vLancar;

        // Isi data grafik (Konversi ke Juta)
        buckets['LANCAR'] += vLancar / 1000000;
        buckets['1-30 H'] += v1_30 / 1000000;
        buckets['31-60 H'] += v31_60 / 1000000;
        buckets['>60 H'] += vOver60 / 1000000;

        // 3. Klasifikasi Cash vs Leasing (Target Total 71 Unit)
        if (leasingName === "CASH") {
            cashNominal += os;
            cashUnit++;
        } else {
            leasingNominal += os;
            leasingUnit++; 

            // 4. Filter Breakdown TVC (Hanya yang Jatuh Tempo > 0 Hari)
            // Ini yang mengubah angka 87 menjadi 29 sesuai tabel image_62e1c1
            if (overdueDays > 0) {
                if (leasingName.includes("ACC")) unitACC++;
                if (leasingName.includes("TAFS")) unitTAFS++;

                if (funcLoc.includes("T710") || funcLoc.includes("GI")) {
                    unitSudahGI++;
                } else {
                    unitRDelivery++;
                }
            }
        }
    });

    // --- 5. UPDATE UI (PASTIKAN ID SESUAI HTML) ---
    // KPI Utama
    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdueNominal)); 
    updateText('total-penalty', formatIDR(totalPenalty));
    updateText('total-lancar', formatIDR(totalLancarNominal));

    // Summary Tengah
    updateText('val-total-cash', formatIDR(cashNominal));
    updateText('unit-cash', cashUnit + " Unit");
    updateText('val-total-leasing', formatIDR(leasingNominal));
    updateText('unit-leasing', leasingUnit + " Unit");

    // Breakdown Leasing TVC (Hasil Filter Jatuh Tempo)
    const totalJatuhTempo = unitACC + unitTAFS;
    updateText('total-penjualan-leasing', totalJatuhTempo + " Unit"); 
    updateText('unit-acc', unitACC + " Unit");
    updateText('unit-tafs', unitTAFS + " Unit");
    updateText('unit-sudah-gi', unitSudahGI + " Unit");
    updateText('unit-r-delivery', unitRDelivery + " Unit");
    updateText('count-overdue', totalJatuhTempo + " Unit Terlambat");

    // Visualisasi
    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
    renderSalesList(data);
    renderTopSPV(data, totalOS);
}