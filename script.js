// Import konfigurasi Supabase (sesuaikan dengan setup project Anda jika menggunakan file terpisah)
// import { supabase } from './supabaseClient.js';

// Pastikan fungsi global bisa dipanggil dari HTML onclick
window.filterTab = filterTab;
window.simpanCatatan = simpanCatatan;

// State Data Global
let globalDataAR = [];

// 1. INITIALIZATION & FETCH DATA
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Aplikasi AR Monitoring Cabang Dimulai...");
    await muatDataUtama();
});

async function muatDataUtama() {
    tampilkanLoading(true);
    try {
        // Mengambil data dari tabel ar_unit di Supabase
        const { data, error } = await supabase
            .from('ar_unit')
            .select('*')
            .order('os_balance', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
            globalDataAR = data;
            
            // Update Informasi Header & Tanggal Arsip
            updateHeaderInfo(data);
            
            // Render semua komponen Dashboard & Tabel
            renderDashboardRingkasan(data);
            renderDataArUnitFull(data);
            renderDatabaseLengkap(data);
            renderTabLeasingFull(data);
            renderTabOverdueFull(data);
        } else {
            console.warn("Tidak ada data ditemukan di tabel ar_unit.");
        }
    } catch (err) {
        console.error("Gagal memuat data dari Supabase:", err.message);
        document.getElementById('status-update').innerText = "GAGAL SINKRONISASI DATA";
    } finally {
        tampilkanLoading(false);
    }
}

function tampilkanLoading(isLoading) {
    const statusEl = document.getElementById('status-update');
    if (statusEl) {
        statusEl.innerText = isLoading ? "MEMUAT & SINKRONISASI DATA..." : "SINKRONISASI SUKSES";
        if (!isLoading) {
            statusEl.classList.remove('text-red-600');
            statusEl.classList.add('text-emerald-500');
        }
    }
}

function updateHeaderInfo(data) {
    const tglArsipEl = document.getElementById('tgl-arsip');
    if (tglArsipEl) {
        // Mengambil sampel tanggal dari baris pertama jika ada data tanggalarsip/updated_at
        tglArsipEl.innerText = "19 MEI 2026"; 
    }
}

// 2. RENDER TAB: DATA AR UNIT (KHUSUS ACC & TAFS PENAGIHAN)
function renderDataArUnitFull(data) {
    const el = document.getElementById('tab-ar-unit-body');
    if (!el) return;

    // Filter hanya untuk leasing ACC dan TAFS sesuai kebutuhan penagihan Anda
    const filterAR = data.filter(d => {
        const l = (d.leasing_name || '').toUpperCase().trim();
        return l.includes('TAFS') || l.includes('ACC');
    });

    if (filterAR.length === 0) {
        el.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400 italic">Tidak ada data ACC & TAFS</td></tr>`;
        return;
    }

    el.innerHTML = filterAR.map((d, i) => `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4 text-slate-800 font-black">${d.customer_name || '-'}</td>
            <td class="p-4">
                <span class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded text-[9px] font-extrabold tracking-wide">${d.leasing_name}</span>
            </td>
            <td class="p-4 text-right text-blue-600 font-black">${fmtIDR(d.os_balance)}</td>
            <td class="p-4 w-48">
                <input type="text" id="cabang-${d.no_init}" value="${d.ket_cabang || ''}" placeholder="Ket cabang..." class="input-custom bg-white">
            </td>
            <td class="p-4 w-48">
                <input type="text" id="plan-${d.no_init}" value="${d.plan_bayar_leasing || ''}" placeholder="Isi plan..." class="input-custom bg-white">
            </td>
            <td class="p-4 w-48">
                <input type="text" id="ket-${d.no_init}" value="${d.keterangan_leasing || ''}" placeholder="Isi ket leasing..." class="input-custom bg-white">
            </td>
            <td class="p-4 text-center w-16">
                <button onclick="simpanCatatan('${d.no_init}')" class="text-blue-600 hover:bg-blue-600 hover:text-white bg-blue-50 p-2 rounded-lg transition-all" title="Simpan">💾</button>
            </td>
        </tr>
    `).join('');
}

// 3. FUNGSI SIMPAN/UPDATE DATA KE SUPABASE
async function simpanCatatan(noInit) {
    // Ambil nilai input berdasarkan id element unik
    const inputCabang = document.getElementById(`cabang-${noInit}`).value;
    const inputPlan = document.getElementById(`plan-${noInit}`).value;
    const inputKet = document.getElementById(`ket-${noInit}`).value;

    try {
        document.getElementById('status-update').innerText = "MENYIMPAN PERUBAHAN...";
        
        // Update data ke tabel ar_unit di Supabase berdasarkan primary key no_init
        const { error } = await supabase
            .from('ar_unit')
            .update({
                ket_cabang: inputCabang,
                plan_bayar_leasing: inputPlan,
                keterangan_leasing: inputKet // Field database tetap target utama
            })
            .eq('no_init', noInit);

        if (error) throw error;

        // Berikan feedback visual sukses sementara
        const statusEl = document.getElementById('status-update');
        statusEl.innerText = "DATA BERHASIL DISIMPAN!";
        statusEl.classList.replace('text-red-600', 'text-emerald-500');
        
        // Refresh data local state agar sinkron tanpa reload page
        const index = globalDataAR.findIndex(item => item.no_init === noInit);
        if (index !== -1) {
            globalDataAR[index].ket_cabang = inputCabang;
            globalDataAR[index].plan_bayar_leasing = inputPlan;
            globalDataAR[index].keterangan_leasing = inputKet;
        }

        setTimeout(() => {
            statusEl.innerText = "SINKRONISASI SUKSES";
        }, 2000);

    } catch (err) {
        console.error("Gagal menyimpan data:", err.message);
        alert("Gagal menyimpan data ke database: " + err.message);
        document.getElementById('status-update').innerText = "GAGAL MENYIMPAN PERUBAHAN";
    }
}

// 4. RENDER TAB: DATABASE LENGKAP
function renderDatabaseLengkap(data) {
    const el = document.getElementById('tab-database-body');
    if (!el) return;

    el.innerHTML = data.map((d, i) => `
        <tr class="hover:bg-slate-50/80 transition-all font-bold uppercase whitespace-nowrap">
            <td class="p-4 text-center text-slate-400">${i + 1}</td>
            <td class="p-4 text-slate-800 font-black">${d.customer_name || '-'}</td>
            <td class="p-4 text-slate-500">${d.leasing_name || 'CASH'}</td>
            <td class="p-4 text-right text-slate-700 font-black">${fmtIDR(d.os_balance)}</td>
            <td class="p-4 text-right text-slate-400">${fmtIDR(d.hari_1_30 || 0)}</td>
            <td class="p-4 text-right text-slate-400">${fmtIDR(d.hari_31_60 || 0)}</td>
            <td class="p-4 text-right text-slate-400">${fmtIDR(d.lebih_60_hari || 0)}</td>
            <td class="p-4 text-right ${d.total_overdue > 0 ? 'text-red-600 font-black' : 'text-slate-400'}">${fmtIDR(d.total_overdue || 0)}</td>
        </tr>
    `).join('');
}

// 5. LOGIKA DASHBOARD (RINGKASAN, CARD METRICS, & CHARTS)
function renderDashboardRingkasan(data) {
    let totalOS = 0, totalOverdue = 0, totalLancar = 0, totalPenalty = 0;
    let countOverdue = 0, countPenalty = 0;

    data.forEach(d => {
        totalOS += (d.os_balance || 0);
        totalOverdue += (d.total_overdue || 0);
        
        if (d.total_overdue > 0) {
            countOverdue++;
        } else {
            totalLancar += (d.os_balance || 0);
        }

        if ((d.penalty_amount || 0) > 0) {
            totalPenalty += d.penalty_amount;
            countPenalty++;
        }
    });

    // Update Card Values
    document.getElementById('total-os').innerText = fmtIDR(totalOS);
    document.getElementById('total-overdue').innerText = fmtIDR(totalOverdue);
    document.getElementById('total-penalty').innerText = fmtIDR(totalPenalty);
    document.getElementById('total-lancar').innerText = fmtIDR(totalLancar);
    
    document.getElementById('badge-overdue').innerText = `${countOverdue} SPK LEWAT TOP`;
    document.getElementById('spk-penalty').innerText = `${countPenalty} SPK TERDAMPAK`;

    // Render Mini Charts/List Tambahan sesuai kebutuhan dashboard Anda
    renderTopSalesAndSpv(data);
}

function renderTopSalesAndSpv(data) {
    // Logika pengelompokan top sales / overdue / spv bisa diletakkan di sini
    // Sesuai dengan komponen UI kecil di bagian bawah dashboard ringkasan Anda
}

function renderTabLeasingFull(data) {
    // Logika render detail breakdown leasing tab
}

function renderTabOverdueFull(data) {
    const el = document.getElementById('tab-overdue-full-list');
    if (!el) return;

    const listOverdue = data.filter(d => (d.total_overdue || 0) > 0);
    if (listOverdue.length === 0) {
        el.innerHTML = `<div class="p-4 text-center text-slate-400 italic">Tidak ada data overdue saat ini</div>`;
        return;
    }

    el.innerHTML = listOverdue.map(d => `
        <div class="p-4 mb-2 bg-red-50/50 rounded-xl border border-red-100 flex justify-between items-center">
            <div>
                <p class="text-xs font-black text-slate-800 uppercase">${d.customer_name || 'UNDEFINED'}</p>
                <p class="text-[9px] text-slate-400 font-bold uppercase">Leasing: ${d.leasing_name || 'CASH'}</p>
            </div>
            <p class="text-xs font-black text-red-600">${fmtIDR(d.total_overdue)}</p>
        </div>
    `).join('');
}

// 6. UTILITY FUNCTIONS
function fmtIDR(val) {
    if (!val) return "Rp 0";
    return "Rp " + parseFloat(val).toLocaleString('id-ID');
}

// Logika Navigasi Tab (jika diperlukan sinkronisasi fungsi antar tab)
function filterTab(btn, tabName) {
    // Fungsi ini dipanggil langsung dari inline HTML untuk trigger pergantian view tab kontainer
    console.log("Navigasi beralih ke:", tabName);
}