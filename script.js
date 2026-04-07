// --- TOP SALESMAN (Unit di Kanan Bawah Angka) ---
document.getElementById('list-salesman').innerHTML = topSales.map((item, i) => `
    <div class="flex justify-between items-start border-b border-slate-50 pb-2">
        <div class="flex flex-col">
            <span class="text-[10px] font-black text-[#1B2559] uppercase">
                <span class="text-slate-300 mr-2">${i+1}.</span>${item[0]}
            </span>
        </div>
        <div class="text-right flex flex-col">
            <span class="text-[11px] font-black text-red-500">${formatJuta(item[1].nominal)}</span>
            <span class="text-[8px] text-slate-400 font-bold uppercase">${item[1].unit} Unit</span>
        </div>
    </div>
`).join('');

// --- TOP SPV (Unit di Kanan Bawah Angka) ---
document.getElementById('list-spv').innerHTML = topSPV.map((item, i) => {
    const percent = ((item[1].nominal / totalGlobalOS) * 100).toFixed(1);
    return `
    <div class="mb-4">
        <div class="flex justify-between items-start mb-1">
            <span class="text-[10px] font-black text-[#1B2559] uppercase">
                <span class="text-slate-300 mr-1">${i+1}.</span>${item[0]}
            </span>
            <div class="text-right flex flex-col">
                <span class="text-[10px] font-black text-purple-600">${formatJuta(item[1].nominal)}</span>
                <span class="text-[7px] text-slate-400 font-bold uppercase">${item[1].unit} Unit</span>
            </div>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-1.5 mb-1">
            <div class="bg-purple-500 h-1.5 rounded-full" style="width: ${percent}%"></div>
        </div>
        <p class="text-[7px] font-bold text-slate-400 uppercase text-right">${percent}% Global Kontribusi</p>
    </div>`;
}).join('');