// Konfigurasi tetap sama
const SUPABASE_URL = "https://ahaoznkudusajtzfbnqj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const rupiah = (n) => "Rp " + (n || 0).toLocaleString("id-ID");

async function loadDashboard() {
    document.getElementById("loading").style.display = "block";

    const { data, error } = await client.from("ar_unit").select("*");

    document.getElementById("loading").style.display = "none";
    if (error) return console.error("Error:", error);

    let stats = { os: 0, overdue: 0, penalty: 0, countingOverdue: 0 };
    let aging = { lancar: 0, h1: 0, h31: 0, h60: 0 };
    let salesmanData = {};
    let overdueList = [];

    data.forEach(d => {
        let os = Number(d.os_balance) || 0;
        let ov = Number(d.total_overdue) || 0;
        
        stats.os += os;
        stats.overdue += ov;
        stats.penalty += (Number(d.Penalty_Amount) || 0);
        if(ov > 0) stats.countingOverdue++;

        // Aging Logic
        aging.lancar += (Number(d.lancar) || 0);
        aging.h1 += (Number(d.hari_1_30) || 0);
        aging.h31 += (Number(d.hari_31_60) || 0);
        aging.h60 += (Number(d.lebih_60_hari) || 0);

        // Salesman logic
        let sName = d.salesman_name || "N/A";
        salesmanData[sName] = (salesmanData[sName] || 0) + os;

        // Overdue list
        if(ov > 0) overdueList.push({ name: d.Customer_Name, val: ov });
    });

    // Update UI Stats
    document.getElementById("total_os").innerText = rupiah(stats.os);
    document.getElementById("total_overdue").innerText = rupiah(stats.overdue);
    document.getElementById("overdue_count").innerText = `${stats.countingOverdue} SPK Lewat TOP`;
    document.getElementById("total_penalty").innerText = rupiah(stats.penalty);
    document.getElementById("belum_tempo").innerText = rupiah(stats.os - stats.overdue);
    document.getElementById("update_time").innerText = new Date().toLocaleString("id-ID");

    // Render Charts
    renderAgingChart(aging);
    
    // Render Top Salesman (Top 5)
    const topSales = Object.entries(salesmanData).sort((a,b) => b[1] - a[1]).slice(0,5);
    let salesHtml = '';
    topSales.forEach(([name, val]) => {
        salesHtml += `<div class="list-row"><span>${name}</span><strong>${rupiah(val)}</strong></div>`;
    });
    document.getElementById("top_salesman").innerHTML = salesHtml;

    // Render Top Overdue
    const topOv = overdueList.sort((a,b) => b.val - a.val).slice(0,5);
    let ovHtml = '';
    topOv.forEach(item => {
        ovHtml += `<div class="list-row"><span>${item.name}</span><strong class="text-red">${rupiah(item.val)}</strong></div>`;
    });
    document.getElementById("top_overdue").innerHTML = ovHtml;
}

function renderAgingChart(aging) {
    const options = {
        chart: { type: 'bar', height: 250, toolbar: {show: false} },
        series: [{ name: 'Balance', data: [aging.lancar, aging.h1, aging.h31, aging.h60] }],
        xaxis: { categories: ['Lancar', '1-30 HR', '31-60 HR', '>60 HR'] },
        colors: ['#16a34a', '#f59e0b', '#ea580c', '#dc2626'],
        plotOptions: { bar: { distributed: true, borderRadius: 4 } }
    };
    new ApexCharts(document.querySelector("#agingChart"), options).render();
}

loadDashboard();