// ==============================================================================
// 1. FUNGSI UTAMA MENGAMBIL DATA DARI SUPABASE
// ==============================================================================
async function muatDataAR() {
    // 🛑 GANTI 'nama_tabel_anda' sesuai nama tabel di Supabase Anda
    const NAMA_TABEL = 'nama_tabel_anda'; 

    const { data: dataSupabase, error } = await supabase
        .from(NAMA_TABEL) 
        .select('*');

    if (error) {
        console.error("Gagal mengambil data dari Supabase:", error.message);
        alert("Gagal sinkronisasi data: " + error.message);
        return;
    }

    console.log("Data mentah dari Supabase:", dataSupabase);
    
    // Panggil semua fungsi render yang ada di dashboard
    renderTabRingkasanAtauLeasing(dataSupabase); 
    renderTabDataARUnit(dataSupabase);           
    renderTabOverdue(dataSupabase);              
    renderTabDatabaseLengkap(dataSupabase);      
}

// ==============================================================================
// 2. RENDER UNTUK TAB "DATA AR UNIT" (Screenshot 1)
// ==============================================================================
function renderTabDataARUnit(data) {
    const tbody = document.getElementById('tbody-ar-unit'); 
    if (!tbody) return;

    tbody.innerHTML = '';

    // Filter khusus ACC & TAFS sesuai kebutuhan penagihan di Screenshot 1
    const dataFilter = data.filter(item => {
        const leasing = (item.leasing_name || '').toUpperCase();
        return leasing === 'ACC' || leasing === 'TAFS';
    });

    dataFilter.forEach((item, index) => {
        const namaCustomer = item.customer_name || '-';
        const leasing = item.leasing_name || '-';
        const osBalance = parseFloat(item.os_balance) || 0;

        // Ambil data teks inputan (jika null/empty, tampilkan string kosong '')
        const planBayar = item.plan_bayar_leasing || '';
        const keterangan = item.keterangan_leasing || '';
        const ketCabang = item.ket_cabang || '';

        // Menggunakan id unik dari supabase (bisa berupa nomor_init atau id)
        const idKey = item.id || item.no_init || index;

        tbody.innerHTML += `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="p-3 text-center">${index + 1}</td>
                <td class="p-3 font-medium text-slate-700">${namaCustomer}</td>
                <td class="p-3 text-center">
                    <span class="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700">${leasing}</span>
                </td>
                <td class="p-3 font-semibold text-blue-600">Rp ${osBalance.toLocaleString('id-ID')}</td>
                <td class="p-3">
                    <input type="text" id="plan-${idKey}" class="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500" placeholder="Isi plan..." value="${planBayar}">
                </td>
                <td class="p-3">
                    <input type="text" id="ket-${idKey}" class="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500" placeholder="Isi keterangan..." value="${keterangan}">
                </td>
                <td class="p-3">
                    <input type="text" id="cabang-${idKey}" class="w-full p-2 border border-slate-200 rounded text-sm focus:outline-none focus:border-blue-500" placeholder="Ket cabang..." value="${ketCabang}">
                </td>
                <td class="p-3 text-center">
                    <button onclick="simpanPerubahan('${idKey}')" class="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all duration-200" title="Simpan Perubahan">
                        💾
                    </button>
                </td>
            </tr>
        `;
    });
}

// ==============================================================================
// 3. FUNGSI UNTUK MENYIMPAN INPUTAN KEMBALI KE SUPABASE (Aksi Tombol Disket)
// ==============================================================================
async function simpanPerubahan(idKey) {
    // Ambil nilai terbaru langsung dari input HTML berdasarkan ID komponen
    const inputPlan = document.getElementById(`plan-${idKey}`).value;
    const inputKet = document.getElementById(`ket-${idKey}`).value;
    const inputCabang = document.getElementById(`cabang-${idKey}`).value;

    const NAMA_TABEL = 'nama_tabel_anda'; // 🛑 Samakan dengan nama tabel Anda

    // Jalankan update ke Supabase
    // Menyesuaikan apakah primary key Anda bernama 'id' atau 'no_init' sesuai Gambar 4
    const { error } = await supabase
        .from(NAMA_TABEL)
        .update({
            plan_bayar_leasing: inputPlan,
            keterangan_leasing: inputKet,
            ket_cabang: inputCabang
        })
        .eq('id', idKey); // Jika di database kolomnya bernama no_init, ganti menjadi .eq('no_init', idKey)

    if (error) {
        console.error("Gagal menyimpan ke Supabase:", error.message);
        alert("Gagal menyimpan data: " + error.message);
    } else {
        alert("Data Berhasil Disimpan ke Supabase! 👍");
        // Reload data agar dashboard mendapatkan status visual paling mutakhir
        muatDataAR(); 
    }
}

// ==============================================================================
// 4. RENDER UNTUK TAB "OVERDUE" (Screenshot 2 - Bebas Undefined)
// ==============================================================================
function renderTabOverdue(data) {
    const containerOverdue = document.getElementById('container-overdue'); 
    if (!containerOverdue) return;

    containerOverdue.innerHTML = '';

    // Ambil data yang nilai total_overdue-nya valid di atas 0
    const dataOverdue = data.filter(item => (parseFloat(item.total_overdue) || 0) > 0);

    if (dataOverdue.length === 0) {
        containerOverdue.innerHTML = `<div class="p-4 text-center text-slate-400 italic bg-white rounded-xl shadow-sm">Tidak ada data overdue saat ini.</div>`;
        return;
    }

    dataOverdue.forEach(item => {
        const namaCustomer = item.customer_name || 'Tanpa Nama';
        const leasing = item.leasing_name || 'CASH';
        const totalOverdue = parseFloat(item.total_overdue) || 0;

        containerOverdue.innerHTML += `
            <div class="p-4 mb-3 bg-white rounded-xl shadow-sm border-l-4 border-red-500 flex justify-between items-center transition-all hover:shadow-md">
                <div>
                    <h4 class="font-bold text-slate-800 italic text-base md:text-lg">${namaCustomer}</h4>
                    <p class="text-xs text-slate-400 font-medium mt-0.5">Leasing: ${leasing}</p>
                </div>
                <div class="text-right">
                    <span class="font-bold text-red-600 text-base md:text-lg">Rp ${totalOverdue.toLocaleString('id-ID')}</span>
                </div>
            </div>
        `;
    });
}

// ==============================================================================
// 5. RENDER UNTUK TAB "DATABASE LENGKAP" (Screenshot 3 & 5)
// ==============================================================================
function renderTabDatabaseLengkap(data) {
    const tbody = document.getElementById('tbody-database-lengkap'); 
    if (!tbody) return;

    tbody.innerHTML = '';

    data.forEach((item, index) => {
        const namaCustomer = item.customer_name || '-';
        const leasing = item.leasing_name || '-';
        const osBalance = parseFloat(item.os_balance) || 0;
        
        // Membaca kolom aging dari database Supabase Anda
        const hari1_30 = parseFloat(item.hari_1_30) || 0;
        const hari31_60 = parseFloat(item.hari_31_60) || 0;
        const lebih60 = parseFloat(item.lebih_so_hari) || 0; 
        const totalOverdue = parseFloat(item.total_overdue) || 0;

        tbody.innerHTML += `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="p-3 text-center text-slate-500">${index + 1}</td>
                <td class="p-3 text-slate-700 font-medium">${namaCustomer}</td>
                <td class="p-3 text-slate-600 text-center">${leasing}</td>
                <td class="p-3 font-semibold text-slate-700">Rp ${osBalance.toLocaleString('id-ID')}</td>
                <td class="p-3 text-slate-600">Rp ${hari1_30.toLocaleString('id-ID')}</td>
                <td class="p-3 text-slate-600">Rp ${hari31_60.toLocaleString('id-ID')}</td>
                <td class="p-3 text-slate-600">Rp ${lebih60.toLocaleString('id-ID')}</td>
                <td class="p-3 text-red-600 font-bold">Rp ${totalOverdue.toLocaleString('id-ID')}</td>
            </tr>
        `;
    });
}

// ==============================================================================
// 6. RENDER UNTUK TAB RINGKASAN / LEASING (Opsional)
// ==============================================================================
function renderTabRingkasanAtauLeasing(data) {
    // Jika Anda memiliki elemen ringkasan total card, render di sini.
    // Dibiarkan kosong agar tidak memicu error jika elemen HTML belum siap.
    console.log("Fungsi ringkasan siap menerima data.");
}

// RUN OTOMATIS SAAT WINDOW SELESAI LOAD
document.addEventListener('DOMContentLoaded', () => {
    muatDataAR();
});