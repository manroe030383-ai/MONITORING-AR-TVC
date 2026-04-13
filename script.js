function processData(data) {
    let totalOS = 0, totalLancar = 0, totalOverdue = 0, totalPenalty = 0;
    let cashNominal = 0, leasingNominal = 0, cashUnit = 0, leasingUnit = 0;
    
    // Tambahkan counter unit baru
    let penaltyCount = 0;
    let tafsCount = 0;
    let accCount = 0;
    
    let aging = { lancar: 0, h1_30: 0, h31_60: 0, over60: 0 };

    data.forEach(item => {
        const nominal = parseFloat(item.os_balance) || 0;
        const penalty = parseFloat(item.penalty_amount) || 0;
        const leasingName = (item.leasing_name || "").toUpperCase().trim();
        const statusAging = (item.status_aging || "").toUpperCase().trim();

        totalOS += nominal;

        // Logika Cash vs Leasing & Breakdown Detail
        if (leasingName === 'CASH') {
            cashNominal += nominal;
            cashUnit++;
        } else {
            leasingNominal += nominal;
            leasingUnit++;
            // Hitung breakdown untuk TAFS dan ACC
            if (leasingName === 'TAFS') tafsCount++;
            if (leasingName === 'ACC') accCount++;
        }

        // Klasifikasi Aging (Gunakan .toUpperCase agar lebih aman)
        if (statusAging === 'LANCAR') {
            totalLancar += nominal;
            aging.lancar += nominal;
        } else {
            totalOverdue += nominal;
            if (statusAging === '1-30 HR') aging.h1_30 += nominal;
            else if (statusAging === '31-60 HR') aging.h31_60 += nominal;
            else aging.over60 += nominal;
        }
        
        // Hitung Potensi Penalti & Unitnya
        if (penalty > 0) {
            totalPenalty += penalty;
            penaltyCount++;
        }
    });

    // Kirim penaltyCount, tafsCount, dan accCount ke UI
    updateUI(totalOS, totalOverdue, totalPenalty, totalLancar, cashNominal, leasingNominal, cashUnit, leasingUnit, penaltyCount, tafsCount, accCount);
    renderCharts(aging, [cashNominal, leasingNominal]);
    updateSalesmanList(data);
}

function updateUI(os, overdue, penalty, lancar, cNom, lNom, cUnit, lUnit, pCount, tCount, aCount) {
    const fmt = (v) => "Rp " + v.toLocaleString('id-ID');
    
    document.getElementById('total-os').innerText = fmt(os);
    document.getElementById('total-overdue').innerText = fmt(overdue);
    document.getElementById('total-penalty').innerText = fmt(penalty);
    document.getElementById('total-lancar').innerText = fmt(lancar);
    
    // Perbaikan: Update label SPK agar tidak "0 SPK" lagi
    const labelPenalty = document.querySelector('.bg-white:has(#total-penalty) p.text-slate-400');
    if(labelPenalty) labelPenalty.innerText = `DARI ${pCount} SPK`;
    
    document.getElementById('val-total-cash').innerText = fmt(cNom);
    document.getElementById('val-total-leasing').innerText = fmt(lNom);
    document.getElementById('unit-cash').innerText = cUnit + " Unit";
    document.getElementById('unit-leasing').innerText = lUnit + " Unit";

    // Update Breakdown Leasing TVC di bagian bawah
    if(document.getElementById('total-unit-leasing-tvc')) 
        document.getElementById('total-unit-leasing-tvc').innerText = (tCount + aCount) + " Unit";
    if(document.getElementById('unit-tafs')) document.getElementById('unit-tafs').innerText = tCount + " Unit";
    if(document.getElementById('unit-acc')) document.getElementById('unit-acc').innerText = aCount + " Unit";

    const total = cNom + lNom;
    const pCash = (cNom / total * 100) || 0;
    document.getElementById('bar-cash').style.width = pCash + "%";
    document.getElementById('bar-leasing').style.width = (100 - pCash) + "%";
}