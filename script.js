// 1. Konfigurasi Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const _supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Formatters
const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
const formatJT = (val) => (val / 1000000).toFixed(1);

async function fetchAndRenderDashboard() {
    try {
        console.log("Memulai penarikan data dari tabel: ar_unit...");
        
        // SESUAI SCREENSHOT: Nama tabel adalah 'ar_unit'
        const { data, error } = await _supabase
            .from('ar_unit') 
            .select('*');

        if (error) throw error;
        console.log("Data berhasil ditarik:", data);

        // --- A. STATS CALCULATION ---
        // Catatan: Pastikan ada kolom 'nominal' dan 'days_overdue' di tabel ar_unit kamu
        const totalOS = data.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
        const overdueData = data.filter(item => (Number(item.days_overdue) || 0) > 0);
        const totalOverdue = overdueData.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
        const totalLancar = totalOS - totalOverdue;
        
        // Render ke HTML
        document.getElementById('total-os').innerText = formatIDR(totalOS);
        document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
        document.getElementById('count-overdue').innerText = `${overdueData.length} SPK Lewat TOP`;
        document.getElementById('total-lancar').innerText = formatIDR(totalLancar);

        // --- B. KOMPOSISI PAYMENT ---
        // Di screenshot kolomnya 'leasing_name'. Jika 'CASH' maka itu tunai.
        const cashData = data.filter(item => item.leasing_name?.toUpperCase() === 'CASH');
        const leasingData = data.filter(item => item.leasing_name?.toUpperCase() !== 'CASH');
        
        const sumCash = cashData.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
        const sumLeasing = leasingData.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);

        document.getElementById('val-total-cash').innerText = formatIDR(sumCash);
        document.getElementById('unit-cash').innerText = `${cashData.length} Unit`;
        document.getElementById('val-total-leasing').innerText = formatIDR(sumLeasing);
        document.getElementById('unit-leasing').innerText = `${leasingData.length} Unit`;

        // --- C. RENDER CHARTS & LISTS ---
        renderAgingChart(data);
        renderDonutChart(sumCash, sumLeasing);
        renderSalesmanList(data);
        renderOverdueList(overdueData);

        document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;

    } catch (err) {
        console.error('Error:', err.message);
        document.getElementById('tgl-update-text').innerText = "DATA UPDATE: GAGAL KONEKSI";
    }
}

function renderSalesmanList(data) {
    const container = document.getElementById('list-salesman');
    const salesMap = {};
    
    // SESUAI SCREENSHOT: Kolomnya adalah 'salesman_name'
    data.forEach(item => {
        const name = item.salesman_name || 'Tanpa Nama';
        salesMap[name] = (salesMap[name] || 0) + (Number(item.nominal) || 0);
    });

    const sortedSales = Object.entries(salesMap).sort((a,b) => b[1] - a[1]).slice(0, 5);
    
    container.innerHTML = sortedSales.map(([name, val], idx) => `
        <div class="flex justify-between items-center text-[10px] font-bold mb-4">
            <span class="text-slate-500">${idx+1}. ${name}</span>
            <span class="text-red-500">${formatJT(val)} JT</span>
        </div>
    `).join('');
}

// ... Fungsi renderAgingChart, renderDonutChart, renderOverdueList tetap sama seperti sebelumnya ...

document.addEventListener('DOMContentLoaded', fetchAndRenderDashboard);