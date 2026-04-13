// Konfigurasi
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Pastikan Key Lengkap
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncSupabaseData() {
    console.log("=== Memulai Sinkronisasi Data ===");
    
    // Tarik data
    const { data, error } = await _supabase
        .from('ar_unit')
        .select('*');

    if (error) {
        console.error("❌ Gagal tarik data dari Supabase:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.warn("⚠️ Data berhasil ditarik tapi tabel 'ar_unit' kosong.");
        return;
    }

    console.log("✅ Data berhasil diterima. Jumlah baris:", data.length);
    console.log("Contoh baris pertama:", data[0]); // Cek nama kolom di konsol browser

    renderDashboard(data);
}

function renderDashboard(data) {
    const formatIDR = new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        maximumFractionDigits: 0 
    });

    try {
        // --- 1. PERHITUNGAN ---
        const totalOS = data.reduce((acc, curr) => acc + (Number(curr.os_balance) || 0), 0);
        const totalOverdue = data.reduce((acc, curr) => acc + (Number(curr.total_overdue) || 0), 0);
        const totalPenalty = data.reduce((acc, curr) => acc + (Number(curr.penalty_amount) || 0), 0);
        const totalLancar = data.reduce((acc, curr) => acc + (Number(curr.lancar) || 0), 0);

        // --- 2. UPDATE UI HEADER ---
        // Kita gunakan pencarian teks "Rp" untuk mencari elemen yang harus diupdate jika ID tidak ada
        const allH3 = document.querySelectorAll('h3.font-black');
        
        if (allH3.length >= 4) {
            allH3[0].innerText = formatIDR.format(totalOS);
            allH3[1].innerText = formatIDR.format(totalOverdue);
            allH3[2].innerText = formatIDR.format(totalPenalty);
            allH3[3].innerText = formatIDR.format(totalLancar);
            console.log("✅ Header UI Updated");
        } else {
            console.error("❌ Elemen H3 untuk Header tidak ditemukan. Periksa class HTML Anda.");
        }

        // --- 3. CASH vs LEASING ---
        const cashData = data.filter(item => String(item.leasing_name).toUpperCase() === 'CASH');
        const valCash = cashData.reduce((acc, curr) => acc + (Number(curr.os_balance) || 0), 0);
        const valLeasing = totalOS - valCash;

        // Cari elemen berdasarkan teks atau container
        const cashEl = document.querySelector('.bg-emerald-50 .font-black') || document.querySelector('.text-emerald-600.font-black');
        const leasingEl = document.querySelector('.bg-indigo-50 .font-black') || document.querySelector('.text-indigo-600.font-black');

        if (cashEl) cashEl.innerText = formatIDR.format(valCash);
        if (leasingEl) leasingEl.innerText = formatIDR.format(valLeasing);

        // --- 4. TOP 5 SALESMAN ---
        const salesGroup = {};
        data.forEach(item => {
            const name = item.salesman_name || 'N/A';
            salesGroup[name] = (salesGroup[name] || 0) + (Number(item.os_balance) || 0);
        });

        const sortedSales = Object.entries(salesGroup)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        const salesList = document.getElementById('list-salesman');
        if (salesList) {
            salesList.innerHTML = sortedSales.map(([name, val], i) => `
                <div class="flex justify-between items-center text-[10px] font-bold border-b border-slate-50 py-2">
                    <span class="text-slate-600 uppercase">${i + 1}. ${name}</span>
                    <p class="text-red-600">${(val / 1000000).toFixed(1)} Jt</p>
                </div>
            `).join('');
        }

        console.log("=== Render Selesai ===");

    } catch (err) {
        console.error("❌ Error saat merender dashboard:", err);
    }
}

// Jalankan fungsi
syncSupabaseData();