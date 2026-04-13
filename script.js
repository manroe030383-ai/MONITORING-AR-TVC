// 1. Konfigurasi Client
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncSupabaseData() {
    console.log("Menghubungkan ke Supabase...");
    
    const { data, error } = await _supabase
        .from('ar_unit')
        .select('*');

    if (error) {
        console.error("❌ Koneksi Gagal:", error.message);
        return;
    }

    if (data) {
        console.log("✅ Data Berhasil Ditarik:", data.length, "baris.");
        renderDashboard(data);
    }
}

function renderDashboard(data) {
    const formatIDR = new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        maximumFractionDigits: 0 
    });

    // --- A. KALKULASI DATA ---
    const totalOS = data.reduce((acc, curr) => acc + (Number(curr.os_balance) || 0), 0);
    const totalOverdue = data.reduce((acc, curr) => acc + (Number(curr.total_overdue) || 0), 0);
    const totalPenalty = data.reduce((acc, curr) => acc + (Number(curr.penalty_amount) || 0), 0);
    const totalLancar = data.reduce((acc, curr) => acc + (Number(curr.lancar) || 0), 0);

    // --- B. UPDATE UI (HEADER KARTU) ---
    // Gunakan id agar coding langsung mengenali tempat angkanya
    const elOS = document.getElementById('total-os');
    const elOverdue = document.getElementById('total-overdue');
    const elPenalty = document.getElementById('total-penalty');
    const elLancar = document.getElementById('total-lancar');

    if (elOS) elOS.innerText = formatIDR.format(totalOS);
    if (elOverdue) elOverdue.innerText = formatIDR.format(totalOverdue);
    if (elPenalty) elPenalty.innerText = formatIDR.format(totalPenalty);
    if (elLancar) elLancar.innerText = formatIDR.format(totalLancar);

    // --- C. CASH VS LEASING ---
    const cashData = data.filter(item => String(item.leasing_name).toUpperCase() === 'CASH');
    const valCash = cashData.reduce((acc, curr) => acc + (Number(curr.os_balance) || 0), 0);
    const valLeasing = totalOS - valCash;

    const elCashVal = document.getElementById('val-cash');
    const elLeasingVal = document.getElementById('val-leasing');
    
    if (elCashVal) elCashVal.innerText = formatIDR.format(valCash);
    if (elLeasingVal) elLeasingVal.innerText = formatIDR.format(valLeasing);

    // --- D. TOP 5 SALESMAN ---
    const salesGroup = {};
    data.forEach(item => {
        const name = item.salesman_name || 'TANPA NAMA';
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
}

// Jalankan otomatis saat web dibuka
syncSupabaseData();