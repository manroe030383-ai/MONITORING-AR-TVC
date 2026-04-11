const SUPABASE_URL = "https://ahaoznkudusajtzfbnqj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s"; 
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const rupiah = (n) => "Rp " + (n || 0).toLocaleString("id-ID");

async function loadDashboard() {
    document.getElementById("loading").style.display = "block";

    const { data, error } = await client.from("ar_unit").select("*");

    document.getElementById("loading").style.display = "none";
    if (error) return console.error("Error Supabase:", error);

    let stats = { os: 0, overdue: 0, penalty: 0, ovCount: 0, cash: 0, leasing: 0 };
    let aging = { lancar: 0, h1: 0, h31: 0, h60: 0 };
    let salesMap = {};
    let ovArray = [];

    data.forEach(d => {
        let os = Number(d.os_balance) || 0;
        let ov = Number(d.total_overdue) || 0;
        
        stats.os += os;
        stats.overdue += ov;
        stats.penalty += (Number(d.Penalty_Amount) || 0);
        if(ov > 0) stats.ovCount++;

        // Hitung Komposisi Cash vs Leasing
        if(d.Leasing_Name && d.Leasing_Name !== "CASH") {
            stats.leasing += os;
        } else {
            stats.cash += os;
        }

        // Aging
        aging.lancar += (Number(d.lancar) || 0);
        aging.h1 += (Number(d.hari_1_30) || 0);
        aging.h31 += (Number(d.hari_31_60) || 0);
        aging.h60 += (Number(d.lebih_60_hari) || 0);

        // Salesman
        let sName = d.salesman_name || "No Name";
        salesMap[sName] = (salesMap[sName] || 0) + os;

        // Overdue List (Anti-Undefined)
        if(ov > 0) {
            ovArray.push({
                name: d.Customer_Name || d.customer_name || "Unknown Customer",
                val: ov
            });
        }
    });

    // Update UI
    document.getElementById("total_os").innerText = rupiah(stats.os);
    document.getElementById("total_overdue").innerText = rupiah(stats.overdue);
    document.getElementById("overdue_count").innerText = `${stats.ovCount} SPK Lewat TOP`;
    document.getElementById("total_penalty").innerText = rupiah(stats.penalty);
    document.getElementById("belum_tempo").innerText = rupiah(stats.os - stats.overdue);

    // Charts
    renderAgingChart(aging);
    renderDonutChart(stats.cash, stats.leasing);

    // Render Lists
    renderList("top_salesman", Object.entries(salesMap).sort((a,b) => b[1]-a[1]).slice(0,5));
    renderList("top_overdue", ovArray.sort((a,b) => b.val-a.val).slice(0,5), true);
}

function renderAgingChart(aging) {
    new ApexCharts(document.querySelector("#agingChart"), {
        chart: { type: 'bar', height: 250, toolbar: {show: false} },
        plotOptions: { bar: { borderRadius: 6, distributed: true } },
        series: [{ name: 'Balance', data: [aging.lancar, aging.h1, aging.h31, aging.h60] }],
        xaxis: { categories: ['Lancar', '1-30 HR', '31-60 HR', '>60 HR'] },
        colors: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
        dataLabels: { enabled: false }
    }).render();
}

function renderDonutChart(cash, leasing) {
    new ApexCharts(document.querySelector("#salesDonutChart"), {
        chart: { type: 'donut', height: 250 },
        series: [cash, leasing],
        labels: ['Cash', 'Leasing'],
        colors: ['#10b981', '#3b82f6'],
        legend: { position: 'bottom' }
    }).render();
}

function renderList(targetId, arr, isOverdue = false) {
    let html = '';
    arr.forEach(item => {
        let name = isOverdue ? item.name : item[0];
        let val = isOverdue ? item.val : item[1];
        html += `<div class="row"><span>${name}</span><strong>${rupiah(val)}</strong></div>`;
    });
    document.getElementById(targetId).innerHTML = html;
}

loadDashboard();