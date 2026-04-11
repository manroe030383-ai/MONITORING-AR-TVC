// 1. Konfigurasi Client
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';

const _supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Helper Formatter
const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
const toJuta = (val) => (val / 1000000).toFixed(1);

async function initDashboard() {
    try {
        console.log("Mencoba fetch data...");
        // Nama tabel harus sesuai dengan screenshot: ar_unit
        const { data, error } = await _supabase.from('ar_unit').select('*');

        if (error) {
            console.error("Gagal tarik data:", error.message);
            return;
        }

        console.log("Data berhasil diterima:", data);

        // --- A. AGREGASI DATA (PENTING: Nama kolom harus sesuai DB) ---
        // Asumsi kolom nominal di DB bernama 'nominal'. Jika berbeda, ganti d.nominal dibawah.
        const totalOS = data.reduce((acc, d) => acc + (Number(d.nominal) || 0), 0);
        const overdueData = data.filter(d => (Number(d.days_overdue) || 0) > 0);
        const totalOverdue = overdueData.reduce((acc, d) => acc + (Number(d.nominal) || 0), 0);
        const totalLancar = totalOS - totalOverdue;

        // --- B. UPDATE STATS CARD ---
        document.getElementById('total-os').innerText = formatIDR(totalOS);
        document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
        document.getElementById('total-lancar').innerText = formatIDR(totalLancar);
        // Update jumlah SPK terlambat sesuai gambar
        const countOverdueEl = document.getElementById('count-overdue');
        if(countOverdueEl) countOverdueEl.innerText = `${overdueData.length} SPK Lewat TOP`;

        // --- C. KOMPOSISI CASH VS LEASING ---
        // Sesuai screenshot DB kolom 'leasing_name'
        const cashList = data.filter(d => d.leasing_name?.toUpperCase() === 'CASH');
        const leasingList = data.filter(d => d.leasing_name?.toUpperCase() !== 'CASH');
        
        const sumCash = cashList.reduce((acc, d) => acc + (Number(d.nominal) || 0), 0);
        const sumLeasing = leasingList.reduce((acc, d) => acc + (Number(d.nominal) || 0), 0);

        document.getElementById('val-total-cash').innerText = formatIDR(sumCash);
        document.getElementById('unit-cash').innerText = `${cashList.length} Unit`;
        document.getElementById('val-total-leasing').innerText = formatIDR(sumLeasing);
        document.getElementById('unit-leasing').innerText = `${leasingList.length} Unit`;

        // --- D. RENDER LIST & CHARTS ---
        renderTopSalesman(data);
        // Panggil fungsi chart Anda disini (renderAgingChart, dll)

    } catch (e) {
        console.error("System Error:", e);
    }
}

function renderTopSalesman(data) {
    const container = document.getElementById('list-salesman');
    if (!container) return;

    const salesMap = {};
    data.forEach(d => {
        const name = d.salesman_name || 'Unknown'; // Sesuai kolom DB
        salesMap[name] = (salesMap[name] || 0) + (Number(d.nominal) || 0);
    });

    const sorted = Object.entries(salesMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    container.innerHTML = sorted.map(([name, val], i) => `
        <div class="flex justify-between text-[10px] font-bold mb-2">
            <span>${i+1}. ${name}</span>
            <span class="text-red-500">${toJuta(val)} JT</span>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', initDashboard);