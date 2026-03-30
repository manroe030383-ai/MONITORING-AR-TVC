const SB_URL = 'https://hnefaswbhaclsvtojmlk.supabase.co';
const SB_KEY = 'sb_publishable_Z3HCV9sEiJfcisoht1FaMw_rLMlrIUB'; 
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

async function loadData() {
    console.log("Memulai ambil data...");
    try {
        const { data, error } = await supabaseClient.from('ar_unit').select('*');
        if (error) throw error;
        
        console.log("Data berhasil ditarik:", data); // Cek di F12 Console
        renderDashboard(data);
    } catch (err) {
        console.error("Gagal:", err.message);
    }
}

function renderDashboard(data) {
    let stats = { os: 0, ovd: 0, penalty: 0, count: 0 };
    const tableBody = document.getElementById('masterTable');
    tableBody.innerHTML = '';

    data.forEach(item => {
        // Ambil data dengan mencoba berbagai variasi nama kolom (antisipasi typo)
        const osVal = parseFloat(item.os_balance || item.OS_Balance || 0);
        const ovdVal = parseFloat(item.total_overdue || item.Total_Overdue || 0);
        const pnlVal = parseFloat(item.Penalty_Amount || item.penalty_amount || 0);
        const customer = item.Customer_Name || item.customer_name || '-';
        const unit = item.Material_Code || item.material_code || '-';
        const status = item.Status_Aging || item.status_aging || 'N/A';

        stats.os += osVal;
        stats.ovd += ovdVal;
        stats.penalty += pnlVal;
        if (ovdVal > 0) stats.count++;

        tableBody.insertAdjacentHTML('beforeend', `
            <tr class="border-b hover:bg-slate-50">
                <td class="px-8 py-4 font-bold">${customer}</td>
                <td class="px-8 py-4 text-sm">${unit}</td>
                <td class="px-8 py-4 text-right">${formatIDR(osVal)}</td>
                <td class="px-8 py-4 text-right text-rose-600 font-bold">${formatIDR(ovdVal)}</td>
                <td class="px-8 py-4 text-center">
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold ${status === 'Lancar' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">
                        ${status}
                    </span>
                </td>
            </tr>
        `);
    });

    // Update elemen UI
    document.getElementById('totalOS').innerText = formatIDR(stats.os);
    document.getElementById('totalOverdue').innerText = formatIDR(stats.ovd);
    document.getElementById('totalPenalty').innerText = formatIDR(stats.penalty);
    document.getElementById('overdueCount').innerText = stats.count;
}

function formatIDR(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
}

window.onload = loadData;