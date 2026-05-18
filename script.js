import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = {};
let cachedData = []; 

const fmtIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
const fmtJuta = (v) => (Number(v) / 1000000).toFixed(1) + " Jt";

async function fetchData() {
    try {
        // Fetch data berdasarkan kolom balancing 'os_balance'
        const { data, error } = await supabase.from('ar_unit').select('*').order('os_balance', { ascending: false });
        if (error) throw error;
        if (data) {
            cachedData = data; 
            updateDashboard(data);
            
            if (document.getElementById('status-update')) {
                document.getElementById('status-update').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
                document.getElementById('status-update').className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
            }

            if (document.getElementById('tgl-arsip')) {
                const opsiTanggal = { year: 'numeric', month: 'short', day: 'numeric' };
                document.getElementById('tgl-arsip').innerText = new Date().toLocaleDateString('id-ID', opsiTanggal).toUpperCase();
            }
        }
    } catch (e) {
        console.error("Gagal menarik data dari Supabase:", e);
        if (document.getElementById('status-update')) {
            document.getElementById('status-update').innerText = "KONEKSI ATAU SKEMA GAGAL!";
            document.getElementById('status-update').className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
        }
    }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, pen: 0, lan: 0, cash: 0, leas: 0, cCash: 0, cLeas: 0, countOv: 0, cPen: 0 };
    let tvc = { total: 0, gi: 0, deliv: 0 };
    
    // Inisialisasi object aging chart nominal dalam Juta
    let aging = { 'LANCAR': 0, '1-30 H': 0, '31-60 H': 0, '>60 H': 0 };
    let mLeas = {}, mSales = {}, mSpv = {}, mOverdueTop = [];

    data.forEach(d => {
        const os = Number(d.os_balance || 0);
        const ov = Number(d.total_overdue || 0);
        const l = (d.leasing_name || 'CASH').toUpperCase().trim();
        
        s.os += os; 
        s.ov += ov; 
        s.pen += Number(d.penalty_amount || 0); 
        s.lan += Number(d.car || 0); // Menghitung kolom 'car' atau penanda kelancaran o/s
        
        if (ov > 0) { s.countOv++; mOverdueTop.push(d); }
        if (Number(d.penalty_amount || 0) > 0) s.cPen++;

        // Kalkulasi pembagian nominal ke Juta untuk grafik batang ApexCharts
        // JIKA data di database Anda berupa nominal asli (ex: 50000000), biarkan pembagian /1000000 ini berjalan.
        aging['LANCAR'] += Number(d.car || 0) / 1000000;
        aging['1-30 H'] += Number(d.hari_1_30 || 0) / 1000000;
        aging['31-60 H'] += Number(d.hari_31_60 || 0) / 1000000;
        aging['>60 H'] += Number(d.lebih_60_hari || 0) / 1000000;

        if (["CASH", "CASH TERIMA", ""].includes(l)) { 
            s.cash += os; s.cCash++; 
        } else { 
            s.leas += os; s.cLeas++; 
            mLeas[l] = (mLeas[l] || 0) + os; 
            if (l.includes('TAFS') || l.includes('ACC')) {
                tvc.total++;
                if (d.status_tagih === 'SUDAH GI') tvc.gi++;
                else tvc.deliv++;
            }
        }

        const rawSales = (d.salesman_name || "").trim();
        const rawSpv = (d.supervisor_name || "").trim();
        const finalSales = rawSales !== "" ? rawSales : (rawSpv !== "" ? rawSpv : "OFFICE");
        const finalSpv = rawSpv !== "" ? rawSpv : "OFFICE";

        mSales[finalSales] = (mSales[finalSales] || 0) + os;
        mSpv[finalSpv] = (mSpv[finalSpv] || 0) + os;
    });

    // Sinkronisasi data numerik ke DOM metrik card utama dashboard
    if(document.getElementById('total-os')) document.getElementById('total-os').innerText = fmtIDR(s.os);
    if(document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = fmtIDR(s.ov);
    if(document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = fmtIDR(s.lan);
    if(document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = fmtIDR(s.pen);
    if(document.getElementById('badge-overdue')) document.getElementById('badge-overdue').innerText = `${s.countOv} SPK LEWAT TOP`;
    if(document.getElementById('spk-penalty')) document.getElementById('spk-penalty').innerText = `${s.cPen} SPK`;
    
    if(document.getElementById('bar-cash') && s.os > 0) document.getElementById('bar-cash').style.width = `${(s.cash/s.os)*100}%`;
    if(document.getElementById('bar-leasing') && s.os > 0) document.getElementById('bar-leasing').style.width = `${(s.leas/s.os)*100}%`;
    if(document.getElementById('val-total-cash')) document.getElementById('val-total-cash').innerText = fmtIDR(s.cash);
    if(document.getElementById('unit-total-cash')) document.getElementById('unit-total-cash').innerText = `${s.cCash} Unit`;
    if(document.getElementById('val-total-leas')) document.getElementById('val-total-leas').innerText = fmtIDR(s.leas);
    if(document.getElementById('unit-total-leas')) document.getElementById('unit-total-leas').innerText = `${s.cLeas} Unit`;

    if(document.getElementById('total-unit-tvc')) document.getElementById('total-unit-tvc').innerText = `${tvc.total} Unit`;
    if(document.getElementById('unit-gi-tvc')) document.getElementById('unit-gi-tvc').innerText = `${tvc.gi} Unit`;
    if(document.getElementById('unit-delivery-tvc')) document.getElementById('unit-delivery-tvc').innerText = `${tvc.deliv} Unit`;

    // Render ulang seluruh grafik komparatif & list komponen tabular
    renderAgingChart(aging);
    renderDonutLeasing(mLeas);
    renderLeasingList(mLeas, s.os);
    renderTopList(mSales, 'list-sales', 'text-blue-600');
    renderTopList(mSpv, 'list-spv', 'text-purple-600');
    renderOverdueTop(mOverdueTop);
    
    renderTabLeasingFull(data);
    renderTabOverdueFull(data);
    
    renderTabDatabaseFull(data); 
    renderDataArUnitFull(data);  
}

function renderAgingChart(agingData) {
    const el = document.querySelector("#chart-aging");
    if (!el) return;
    const options = {
        series: [{ name: 'Juta', data: Object.values(agingData).map(v => Math.round(v)) }],
        chart: { type: 'bar', height: 180, toolbar: { show: false } },
        colors: ['#3B82F6'],
        plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '40%' } },
        dataLabels: { enabled: false },
        xaxis: { categories: Object.keys(agingData), labels: { style: { fontSize: '9px', fontWeight: 600 } } },
        yaxis: { labels: { formatter: function(v) { return 'Rp ' + v + 'M'; } } }
    };
    if (charts.bar) charts.bar.updateOptions(options);
    else { charts.bar = new ApexCharts(el, options); charts.bar.render(); }
}

function renderDonutLeasing(mLeas) {
    const el = document.querySelector("#chart-donut-leasing");
    if (!el) return;
    const options = {
        series: Object.values(mLeas),
        labels: Object.keys(mLeas),
        chart: { type: 'donut', height: 170 },
        legend: { show: false },
        dataLabels: { enabled: false },
        colors: ['#34D399', '#2563EB', '#8B5CF6', '#EC4899']
    };
    if (charts.donut) charts.donut.updateOptions(options);
    else { charts.donut = new ApexCharts(el, options); charts.donut.render(); }
}

function renderLeasingList(map, total) {
    const el = document.getElementById('leasing-list');
    if (!el) return;
    if (total === 0) return;
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([n, v]) => `
        <div class="mb-3">
            <div class="flex justify-between text-[9px] font-bold mb-1 uppercase"><span>${n}</span><span>${((v/total)*100).toFixed(1)}%</span></div>
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div class="bg-blue-600 h-full" style="width: ${(v/total)*100}%"></div></div>
        </div>`).join('');
}

function renderTopList(map, id, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5).map((x,i) => `
        <div class="flex justify-between items-center py-3 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${x[0]}</span>
            <span class="text-[10px] ${colorClass}">${fmtJuta(x[1])}</span>
        </div>`).join('');
}

function renderOverdueTop(data) {
    const el = document.getElementById('list-overdue');
    if (!el) return;
    el.innerHTML = data.slice(0,5).map((d,i) => `
        <div class="flex justify-between py-2 border-b border-slate-50 uppercase font-bold">
            <span class="text-[10px] text-slate-600 truncate w-32">${i+1}. ${d.nama_customer || '-'}</span>
            <span class="text-[10px] text-red-500">${fmtJuta(d.total_overdue)}</span>
        </div>`).join('');
}

function renderTabLeasingFull(data) {
    const el = document.getElementById('tab-leasing-full-list');
    if (!el) return;
    const leasingData = data.filter(d => {
        const l = (d.leasing_name || 'CASH').toUpperCase().trim();
        return !["CASH", "CASH TERIMA", ""].includes(l);
    });
    
    if(leasingData.length === 0) {
        el.innerHTML = `<p class="p-4 text-center text-slate-400 italic">Tidak ada data leasing.</p>`;
        return;
    }

    el.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[10px]">
                <thead>
                    <tr class="border-b border-slate-100 text-slate-400 font-bold bg-slate-50 uppercase">
                        <th class="p-3 w-12 text-center">No</th>
                        <th class="p-3">Nama Customer / Sales</th>
                        <th class="p-3">Nama Leasing</th>
                        <th class="p-3 text-right pr-6">O/S Balance</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                    ${leasingData.map((d, i) => `
                        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase">
                            <td class="p-3 text-center text-slate-400">${i+1}</td>
                            <td class="p-3">
                                <p class="text-slate-800 text-[11px] font-black">${d.nama_customer || '-'}</p>
                                <p class="text-[8px] text-slate-400 mt-0.5">👤 SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
                            </td>
                            <td class="p-3">
                                <span class="bg-blue-50 text-blue-700 px-2.5 py-1 rounded text-[9px] font-extrabold tracking-wide">${d.leasing_name}</span>
                            </td>
                            <td class="p-3 text-right pr-6 text-blue-600 text-[11px] font-black">${fmtIDR(d.os_balance)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

function renderTabOverdueFull(data) {
    // Perbaikan target ID: disesuaikan dengan ID bawaan template HTML 'tab-overdue-list'
    const el = document.getElementById('tab-overdue-list');
    if (!el) return;
    const overdueData = data.filter(d => Number(d.total_overdue || 0) > 0);

    if(overdueData.length === 0) {
        el.innerHTML = `<p class="p-4 text-center text-slate-400 italic">Tidak ada rekaman data Overdue Unit.</p>`;
        return;
    }

    el.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[10px]">
                <thead>
                    <tr class="border-b border-slate-100 text-slate-400 font-bold bg-slate-50 uppercase">
                        <th class="p-3 w-12 text-center">No</th>
                        <th class="p-3">Nama Customer</th>
                        <th class="p-3">Leasing</th>
                        <th class="p-3 text-right text-red-500 bg-red-50/50">Total Overdue</th>
                        <th class="p-3 text-right pr-6">O/S Balance</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                    ${overdueData.map((d, i) => `
                        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase">
                            <td class="p-3 text-center text-slate-400">${i+1}</td>
                            <td class="p-3">
                                <p class="text-slate-800 text-[11px] font-black">${d.nama_customer || '-'}</p>
                                <p class="text-[8px] text-slate-400 mt-0.5">👤 SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
                            </td>
                            <td class="p-3">
                                <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">${d.leasing_name || 'CASH'}</span>
                            </td>
                            <td class="p-3 text-right font-black text-red-600 bg-red-50/20">${fmtIDR(d.total_overdue)}</td>
                            <td class="p-3 text-right pr-6 text-blue-600 text-[11px] font-bold">${fmtIDR(d.os_balance)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

function renderTabDatabaseFull(data) {
    // Sinkronisasi penamaan ID tabel database lengkap ke 'table-database-body'
    const targetElement = document.getElementById('table-database-body'); 
    if (!targetElement) return;

    if(data.length === 0) {
        targetElement.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400 italic">Database kosong.</td></tr>`;
        return;
    }

    targetElement.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap">
            <td class="p-3 text-center text-slate-400">${i+1}</td>
            <td class="p-3">
                <p class="text-slate-800 text-[11px] font-black">${d.nama_customer || '-'}</p>
                <p class="text-[8px] text-slate-400 mt-0.5">SPK: ${d.no_spk || '-'}</p>
            </td>
            <td class="p-3"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">${d.leasing_name || 'CASH'}</span></td>
            <td class="p-3 text-right text-blue-600 font-black">${fmtIDR(d.os_balance)}</td>
            <td class="p-3 text-right text-amber-500">${fmtIDR(d.hari_1_30 || 0)}</td>
            <td class="p-3 text-right text-orange-500">${fmtIDR(d.hari_31_60 || 0)}</td>
            <td class="p-3 text-right text-red-600">${fmtIDR(d.lebih_60_hari || 0)}</td>
            <td class="p-3 font-bold text-red-500 text-right">${fmtIDR(d.total_overdue || 0)}</td>
        </tr>`).join('');
}

function renderDataArUnitFull(data) {
    // Sinkronisasi target ID manipulasi tabel input AR Unit ke 'table-arunit-body'
    const targetElement = document.getElementById('table-arunit-body'); 
    if (!targetElement) return;

    // Filter khusus monitoring leasing eksternal ACC dan TAFS
    const filteredData = data.filter(d => {
        const lease = (d.leasing_name || '').toUpperCase().trim();
        return lease.includes('ACC') || lease.includes('TAFS');
    });

    if (filteredData.length === 0) {
        targetElement.innerHTML = `
            <tr>
                <td colspan="8" class="p-4 text-center text-slate-400 italic">
                    Tidak ada data AR Unit dengan metode pembayaran ACC / TAFS.
                </td>
            </tr>`;
        return;
    }

    targetElement.innerHTML = filteredData.map((d, i) => {
        const currentPlan = d.plan_bayar_leasing || '';
        const currentKet = d.ket_leasing || d.keterangan_leasing || ''; 
        const currentCabang = d.ket_cabang || '-';
        const currentOS = d.os_balance || 0;
        const idRow = d.id; 

        return `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap">
            <td class="p-3 text-center text-slate-400">${i + 1}</td>
            <td class="p-3">
                <p class="text-slate-800 text-[11px] font-black">${d.nama_customer || '-'}</p>
                <p class="text-[8px] text-slate-400 mt-0.5">👤 SALES: ${d.salesman_name || d.supervisor_name || 'OFFICE'}</p>
            </td>
            <td class="p-3"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">${d.leasing_name}</span></td>
            <td class="p-3 font-bold text-blue-600">${fmtIDR(currentOS)}</td>
            <td class="p-3"><input type="number" id="input-plan-${idRow}" class="input-custom" value="${currentPlan}" placeholder="Isi plan..."></td>
            <td class="p-3"><input type="number" id="input-ket-${idRow}" class="input-custom" value="${currentKet}" placeholder="Isi keterangan..."></td>
            <td class="p-3"><input type="number" id="input-cabang-${idRow}" class="input-custom" value="${currentCabang}" placeholder="Ket cabang..."></td>
            <td class="p-3 text-center">
                <button data-id="${idRow}" class="btn-save-row bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white p-1.5 rounded transition-all shadow-sm" title="Simpan Perubahan">💾</button>
            </td>
        </tr>`;
    }).join('');
}

async function saveRowData(idRow, buttonElement) {
    const planValue = document.getElementById(`input-plan-${idRow}`).value;
    const ketValue = document.getElementById(`input-ket-${idRow}`).value;
    const cabangValue = document.getElementById(`input-cabang-${idRow}`).value;

    const originalIcon = buttonElement.innerText;
    buttonElement.innerText = "⏳";
    buttonElement.disabled = true;

    try {
        const { error } = await supabase
            .from('ar_unit')
            .update({ 
                plan_bayar_leasing: planValue ? parseInt(planValue) : null, 
                ket_leasing: ketValue ? parseInt(ketValue) : null,
                ket_cabang: cabangValue ? parseInt(cabangValue) : null
            })
            .eq('id', idRow);

        if (error) throw error;

        buttonElement.innerText = "✅";
        setTimeout(() => {
            buttonElement.innerText = originalIcon;
            buttonElement.disabled = false;
            fetchData(); // Muat ulang data terbaru pasca penyimpanan berhasil
        }, 1200);

    } catch (e) {
        console.error("Gagal melakukan update baris data:", e);
        alert(`Gagal menyimpan perubahan: ${e.message || e}`);
        buttonElement.innerText = "❌";
        setTimeout(() => {
            buttonElement.innerText = originalIcon;
            buttonElement.disabled = false;
        }, 1200);
    }
}

function downloadExcel() {
    if (cachedData.length === 0) {
        alert("Data belum dimuat sepenuhnya. Mohon tunggu.");
        return;
    }
    const dataToExport = cachedData.map((d, idx) => ({
        "No": idx + 1,
        "No SPK": d.no_spk || "",
        "Nama Customer": d.nama_customer ? d.nama_customer.toUpperCase() : "",
        "Leasing": d.leasing_name ? d.leasing_name.toUpperCase() : "CASH",
        "O/S Balance": d.os_balance || 0,
        "Hari 1 - 30": d.hari_1_30 || 0,
        "Hari 31 - 60": d.hari_31_60 || 0,
        "Lebih 60 Hari": d.lebih_60_hari || 0,
        "Total Overdue": d.total_overdue || 0,
        "Ket Cabang": d.ket_cabang || "",
        "Plan Bayar": d.plan_bayar_leasing || ""
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AR Unit Overview");
    XLSX.writeFile(workbook, `AR_UNIT_REPORT_${new Date().toISOString().split('T')[0]}.xlsx`);
}

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    
    const btnDownload = document.getElementById('btn-download-excel');
    if (btnDownload) {
        btnDownload.addEventListener('click', downloadExcel);
    }

    document.addEventListener('click', (event) => {
        const button = event.target.closest('.btn-save-row');
        if (button) {
            const rowId = button.getAttribute('data-id');
            saveRowData(rowId, button);
        }
    });
});