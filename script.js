function processDashboard(data) {
    // 1. Inisialisasi hitungan wajib dari nol
    let totalOS = 0, totalOverdueNominal = 0, totalPenalty = 0;
    let cashNominal = 0, leasingNominal = 0;
    let cashUnit = 0, leasingUnit = 0; 
    
    // Variabel rincian TVC (Target: 29 Unit Jatuh Tempo)
    let unitACC = 0, unitTAFS = 0, unitSudahGI = 0, unitRDelivery = 0;

    const buckets = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };

    data.forEach(d => {
        // --- FILTER KETAT (Kunci Utama) ---
        // Jika no_spk kosong, maka ini baris hantu/kosong. Langsung buang.
        if (!d.no_spk || d.no_spk === "") return; 

        // Pemetaan kolom sesuai fisik database Anda
        const os = Number(d.os_balance) || 0;
        const overdueDays = Number(d.hari_overdue) || 0;
        // Gunakan nama kolom total_overd (sesuai image_620f4b)
        const overdueNominal = Number(d.total_overd) || Number(d.total_overdue) || 0;
        const penaltyAmount = Number(d.penalty_amount) || 0;
        
        const vLancar = Number(d.lancar) || 0;
        const v1_30 = Number(d.hari_1_30) || 0;
        const v31_60 = Number(d.hari_31_60) || 0;
        const vOver60 = Number(d.lebih_60_hari) || 0;

        const leasingName = (d.leasing_name || '').toUpperCase().trim();
        const funcLoc = (d.func_loc || '').toUpperCase().trim();

        // 2. Hitung Nominal (Agar tidak Rp 0)
        totalOS += os;
        totalOverdueNominal += overdueNominal;
        totalPenalty += penaltyAmount;

        buckets['LANCAR'] += vLancar / 1000000;
        buckets['1-30 H'] += v1_30 / 1000000;
        buckets['31-60 H'] += v31_60 / 1000000;
        buckets['>60 H'] += vOver60 / 1000000;

        // 3. Klasifikasi Unit
        if (leasingName === "CASH") {
            cashNominal += os;
            cashUnit++;
        } else {
            leasingNominal += os;
            leasingUnit++; 

            // 4. LOGIKA FILTER 29 UNIT (Berdasarkan Status Jatuh Tempo)
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

    // --- 5. EKSEKUSI KE LAYAR ---
    const totalUnitJatuhTempo = unitACC + unitTAFS;

    // Bagian Atas (KPI)
    updateText('total-os', formatIDR(totalOS));
    updateText('total-overdue', formatIDR(totalOverdueNominal)); 
    updateText('total-penalty', formatIDR(totalPenalty));

    // Bagian Tengah (Summary Unit)
    updateText('unit-cash', cashUnit + " Unit");
    updateText('unit-leasing', leasingUnit + " Unit");

    // Bagian Bawah (Breakdown TVC) - MEMAKSA ANGKA 29
    updateText('total-penjualan-leasing', totalUnitJatuhTempo + " Unit"); 
    updateText('unit-acc', unitACC + " Unit");
    updateText('unit-tafs', unitTAFS + " Unit");
    updateText('unit-sudah-gi', unitSudahGI + " Unit");
    updateText('unit-r-delivery', unitRDelivery + " Unit");
    updateText('count-overdue', totalUnitJatuhTempo + " Unit Terlambat");

    renderCharts(cashNominal, leasingNominal, Object.values(buckets));
}