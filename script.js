// 1. Konfigurasi Supabase
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
const supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Utility Functions
const formatIDR = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
const formatJT = (val) => (val / 1000000).toFixed(1);

// 3. Main Function
async function fetchAndRenderDashboard() {
    try {
        // Ganti 'data_ar_unit' dengan nama tabel asli kamu di Supabase
        const { data, error } = await supabase
            .from('data_ar_unit') 
            .select('*');

        if (error) throw error;

        // --- A. PERHITUNGAN STATS CARD ---
        const totalOS = data.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
        const overdueData = data.filter(item => item.days_overdue > 0);
        const totalOverdue = overdueData.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
        const totalLancar = totalOS - totalOverdue;
        
        // Update DOM Stats
        document.getElementById('total-os').innerText = formatIDR(totalOS);
        document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
        document.getElementById('count-overdue').innerText = `${overdueData.length} Unit Terlambat`;
        document.getElementById('total-lancar').innerText = formatIDR(totalLancar);

        // --- B. KOMPOSISI CASH VS LEASING ---
        const cashData = data.filter(item => item.payment_type?.toUpperCase() === 'CASH');
        const leasingData = data.filter(item => item.payment_type?.toUpperCase() === 'LEASING');
        
        const sumCash = cashData.reduce((acc, curr) => acc + (curr.nominal || 0), 0);
        const sumLeasing = leasingData.reduce((acc, curr) => acc + (curr.nominal || 0), 0);

        document.getElementById('val-total-cash').innerText = formatIDR(sumCash);
        document.getElementById('unit-cash').innerText = `${cashData.length} Unit`;
        document.getElementById('pct-cash').innerText = totalOS > 0 ? `${((sumCash/totalOS)*100).toFixed(1)}%` : '0%';

        document.getElementById('val-total-leasing').innerText = formatIDR(sumLeasing);
        document.getElementById('unit-leasing').innerText = `${leasingData.length} Unit`;
        document.getElementById('pct-leasing').innerText = totalOS > 0 ? `${((sumLeasing/totalOS)*100).toFixed(1)}%` : '0%';

        // --- C. RENDER CHARTS ---
        renderAgingChart(data);
        renderDonutChart(sumCash, sumLeasing);

        // --- D. RENDER TOP LISTS (Sales, Overdue, SPV) ---
        renderSalesmanList(data);
        renderOverdueList(overdueData);

        // Update Timestamp
        document.getElementById('tgl-update-text').innerText = `DATA UPDATE: ${