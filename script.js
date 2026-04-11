const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Masukkan key lengkap Anda
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncSupabaseData() {
    // 1. Tarik semua kolom sesuai data yang Anda berikan
    const { data, error } = await _supabase
        .from('ar_unit')
        .select('*');

    if (error) {
        console.error("Gagal tarik data:", error.message);
        return;
    }

    if (data) {
        renderDashboard(data);
    }
}

function renderDashboard(data) {
    const formatIDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

    // --- A. PERHITUNGAN HEADER (KARTU ATAS) ---
    const totalOS = data.reduce((acc, curr) => acc + (Number(curr.os_balance) || 0), 0);
    const totalOverdue = data.reduce((acc, curr) => acc + (Number(curr.total_overdue) || 0), 0);
    const totalLancar = data.reduce((acc, curr) => acc + (Number(curr.lancar) || 0), 0);
    const totalPenalty = data.reduce((acc, curr) => acc + (Number(curr.penalty_amount) || 0), 0);

    // Update UI Header
    document.querySelector('h3.text-xl.font-black').innerText = formatIDR.format(totalOS); // Total O/S
    document.querySelectorAll('h3.text-xl.font-black')[1].innerText = formatIDR.format(totalOverdue); // Total Overdue
    document.querySelectorAll('h3.text-xl.font-black')[2].innerText = formatIDR.format(totalPenalty); // Potensi Penalti
    document.querySelectorAll('h3.text-xl.font-black')[3].innerText = formatIDR.format(totalLancar); // Status Lancar

    // --- B. AGING ANALYSIS (UMUR PIUTANG) ---
    const agingData = {
        lancar: data.reduce((acc, curr) => acc + (Number(curr.lancar) || 0), 0),
        h1_30: data.reduce((acc, curr) => acc + (Number(curr.hari_1_30) || 0), 0),
        h31_60: data.reduce((acc, curr) => acc + (Number(curr.hari_31_60) || 0), 0),
        h60plus: data.reduce((acc, curr) => acc + (Number(curr.lebih_60_hari) || 0), 0)
    };
    // Jika Anda menggunakan Chart.js, masukkan agingData ke dalam chart.data.datasets[0].data

    // --- C. KOMPOSISI PENJUALAN (CASH vs LEASING) ---
    const cashTotal = data.filter(item => item.leasing_name === 'CASH')
                          .reduce((acc, curr) => acc + (Number(curr.os_balance) || 0), 0);
    const leasingTotal = totalOS - cashTotal;

    document.querySelector('.bg-emerald-50 .font-black').innerText = formatIDR.format(cashTotal);
    document.querySelector('.bg-indigo-50 .font-black').innerText = formatIDR.format(leasingTotal);

    // --- D. TOP 5 SALESMAN ---
    const salesGroup = {};
    data.forEach(item => {
        const name = item.salesman_name || 'Tanpa Nama';
        salesGroup[name] = (salesGroup[name] || 0) + (Number(item.os_balance) || 0);
    });

    const sortedSales = Object.entries(salesGroup)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const salesList = document.getElementById('list-salesman');
    if (salesList) {
        salesList.innerHTML = sortedSales.map(([name, val], i) => `
            <div class="flex justify-between items-center text-[10px] font-bold border-b border-slate-50 pb-2">
                <span class="text-slate-600 uppercase">${i+1}. ${name}</span>
                <p class="text-red-600">${(val / 1000000).toFixed(1)} Jt</p>
            </div>
        `).join('');
    }
}

// Jalankan saat halaman dibuka
syncSupabaseData();