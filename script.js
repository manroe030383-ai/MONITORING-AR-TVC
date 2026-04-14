function processDashboard(data) {
    // 1. Inisialisasi hitungan (Reset ke 0)
    let totalOS = 0, totalOverdueNominal = 0, totalPenalty = 0;
    let totalLeasingUnit = 0; // Target dari 71 data
    let unitOverdueTVC = 0;   // Target 29 Unit
    
    let unitACC = 0, unitTAFS = 0, unitGI = 0, unitDelivery = 0;
    let cashNominal = 0, leasingNominal = 0, cashUnit = 0;

    // Objek untuk grafik aging (dalam Juta)
    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        // --- FILTER VALIDASI: Mencegah angka 87 ---
        // Hanya proses baris yang memiliki nama customer
        if (!d.customer_name || d.customer_name.trim() === "") return;

        // Ambil nilai dari kolom database Anda
        const os = Number(d.os_balance) || 0;
        const overdueDays = Number(d.hari_overdue) || 0;
        const overdueNominal = Number(d.total_overdue) || 0; // Sesuai nama kolom di image_60a72d
        const penaltyAmount = Number(d.penalty_amount) || 0;
        
        const vLancar = Number(d.lancar) || 0;
        const v1_30 = Number(d.hari_1_30) || 0;
        const v31_60 = Number(d.hari_31_60) || 0;
        const vOver60 = Number(d.lebih_60_hari) || 0;

        const leasingName = (d.leasing_name || '').toUpperCase().trim();
        const funcLoc = (d.func_loc || '').toUpperCase().trim();

        // Akumulasi Finansial Global
        totalOS += os;
        totalOverdueNominal += overdueNominal;
        totalPenalty += penaltyAmount;

        // Isi data grafik aging
        buckets['LANCAR'] += vLancar / 1000000;
        buckets['1-30 H'] += v1_30 / 1000000;
        buckets['31-60 H'] += v31_60 / 1000000;
        buckets['>60 H'] += vOver60 / 1000000;

        // Pisahkan Cash vs Leasing
        if (leasingName === "CASH") {
            cashNominal += os;
            cashUnit++;
        } else {
            leasingNominal += os;
            totalLeasingUnit++; 

            // Filter Jatuh Tempo: Target 29 Unit
            if (overdueDays > 0) {
                unitOverdueTVC++; 
                if (leasingName.includes("ACC")) unitACC++;
                if (leasingName.includes("TAFS")) unitTAFS++;

                // Klasifikasi GI vs Delivery
                if (funcLoc.includes("T710") || funcLoc.includes("GI")) {
                    unitGI++;
                } else {
                    unitDelivery++;
                }
            }
        }
    });

    // --- UPDATE UI DASHBOARD ---
    // KPI Utama
    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdueNominal)); // Tidak akan Rp0 lagi
    updateText('total-penalty', formatIDR(totalPenalty));

    // Summary Tengah
    updateText('val-total-cash', formatIDR(cashNominal));
    updateText('unit-cash', cashUnit + " Unit");
    updateText('val-total-leasing', formatIDR(leasingNominal));
    updateText('unit-leasing', totalLeasingUnit + " Unit");

    // Breakdown TVC (29 Unit)
    updateText('total-penjualan-leasing', unitOverdueTVC + " Unit"); 
    updateText('unit-acc', unitACC + " Unit");
    updateText('unit-tafs', unitTAFS + " Unit");
    updateText('unit-sudah-gi', unitGI + " Unit");
    updateText('unit-r-delivery', unitDelivery + " Unit");
    updateText('count-overdue', unitOverdueTVC + " Unit Terlambat");

    // Render Visual
    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
    renderSalesList(data);
    renderTopSPV(data, totalOS);
}