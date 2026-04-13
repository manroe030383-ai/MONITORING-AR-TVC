function processData(data) {
    let totalOS = 0, totalLancar = 0, totalOverdue = 0, totalPenalty = 0;
    let cashNominal = 0, leasingNominal = 0, cashUnit = 0, leasingUnit = 0;
    
    // Counter Unit untuk detail
    let penaltyCount = 0;
    let tafsCount = 0;
    let accCount = 0;
    
    // Kategori Aging
    let aging = { lancar: 0, h1_30: 0, h31_60: 0, over60: 0 };

    data.forEach(item => {
        const nominal = parseFloat(item.os_balance) || 0;
        const penalty = parseFloat(item.penalty_amount) || 0;
        totalOS += nominal;

        // 1. Logika Cash vs Leasing
        if (item.leasing_name === 'CASH') {
            cashNominal += nominal;
            cashUnit++;
        } else {
            leasingNominal += nominal;
            leasingUnit++;
            // Hitung Breakdown Leasing TVC
            if (item.leasing_name === 'TAFS') tafsCount++;
            if (item.leasing_name === 'ACC') accCount++;
        }

        // 2. Logika Aging (Pastikan string di database sama persis)
        const status = item.status_aging;
        if (status === 'Lancar') {
            totalLancar += nominal;
            aging.lancar += nominal;
        } else if (status === '1-30 HR') {
            totalOverdue += nominal;
            aging.h1_30 += nominal;
        } else if (status === '31-60 HR') {
            totalOverdue += nominal;
            aging.h31_60 += nominal;
        } else if (status === '>60 HR') {
            totalOverdue += nominal;
            aging.over60 += nominal;
        }
        
        // 3. Logika Potensi Penalti
        if (penalty > 0) {
            totalPenalty += penalty;
            penaltyCount++;
        }
    });

    // Update Tampilan Utama
    updateUI(totalOS, totalOverdue, totalPenalty, totalLancar, cashNominal, leasingNominal, cashUnit, leasingUnit, penaltyCount);
    
    // Update Grafik
    renderCharts(aging, [cashNominal, leasingNominal]);
    
    // Update Detail Leasing TVC (Manual Update ke elemen HTML)
    document.getElementById('total-unit-leasing-tvc').innerText = (tafsCount + accCount) + " Unit";
    document.getElementById('unit-tafs').innerText = tafsCount + " Unit";
    document.getElementById('unit-acc').innerText = accCount + " Unit";
}

// Update fungsi updateUI untuk menerima penaltyCount
function updateUI(os, overdue, penalty, lancar, cNom, lNom, cUnit, lUnit, pCount) {
    const fmt = (v) => "Rp " + v.toLocaleString('id-ID');
    
    document.getElementById('total-os').innerText = fmt(os);
    document.getElementById('total-overdue').innerText = fmt(overdue);
    document.getElementById('total-penalty').innerText = fmt(penalty);
    document.getElementById('total-lancar').innerText = fmt(lancar);
    
    // Perbaikan label SPK Penalti agar tidak 0 SPK lagi
    document.getElementById('count-penalty-label').innerText = `DARI ${pCount} SPK`;
    
    document.getElementById('val-total-cash').innerText = fmt(cNom);
    document.getElementById('val-total-leasing').innerText = fmt(lNom);
    document.getElementById('unit-cash').innerText = cUnit + " Unit";
    document.getElementById('unit-leasing').innerText = lUnit + " Unit";
}