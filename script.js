const SUPABASE_URL = "https://ahaoznkudusajtzfbnqj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const rupiah = (n) => "Rp " + (n || 0).toLocaleString("id-ID");

async function loadDashboard() {
    const { data, error } = await client.from("ar_unit").select("*");
    if (error) return;

    let stats = { os: 0, overdue: 0, penalty: 0, ovCount: 0, cash: 0, leasing: 0 };
    let aging = { lancar: 0, h1: 0, h31: 0, h60: 0 };
    let salesMap = {};
    let spvMap = {};
    let ovArray = [];
    let leasingBreakdown = {};
    let tvc = { total: data.length, gi: 0 };

    data.forEach(d => {
        let os = Number(d.os_balance) || 0;
        let ov = Number(d.total_overdue) || 0;
        let pnlty = Number(d.Penalty_Amount) || 0; // Pastikan nama kolom ini benar

        stats.os += os;
        stats.overdue += ov;
        stats.penalty += pnlty; // Akumulasi penalty
        if(ov > 0) stats.ovCount++;

        // Breakdown Cash vs Leasing
        let lName = (d.Leasing_Name || "CASH").toUpperCase();
        if(lName === "CASH" || lName === "DIRECT") {
            stats.cash += os;
        } else {
            stats.leasing += os;
            leasingBreakdown[lName] = (leasingBreakdown[lName] || 0) + os;
        }

        // TVC logic
        if(d.GI_Date) tvc.gi++;

        // Aging
        aging.lancar += (Number(d.lancar) || 0);
        aging.h1 += (Number(d.hari_1_30) || 0);
        aging.h31 += (Number(d.hari_31_60) || 0);
        aging.h60 += (Number(d.lebih_60_hari) || 0);

        // Salesman & SPV
        salesMap[d.salesman_name] = (salesMap[d.salesman_name] || 0) + os;
        spvMap[d.Supervisor_Name] = (spvMap[d.Supervisor_Name] || 0) + os;

        if(ov > 0) ovArray.push({ name: d.Customer_Name, val: ov });
    });

    // UPDATE UI TEXT
    document.getElementById("total_os").innerText = rupiah(stats.os);
    document.getElementById("total_overdue").innerText = rupiah(stats.overdue);
    document.getElementById("total_penalty").innerText = rupiah(stats.penalty);
    document.getElementById("overdue_count").innerText = `${stats.ovCount} SPK Lewat TOP`;
    document.getElementById("belum_tempo").innerText = rupiah(stats.os - stats.overdue);
    
    // UPDATE DATE META
    const now = new Date();
    document.getElementById("update_time").innerText = now.toLocaleString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }) + " WIB";
    document.getElementById("db_date").innerText = now.toLocaleDateString('id-ID');

    // UPDATE PROGRESS BAR O/S
    const cashPct = (stats.cash / stats.os) * 100;
    const leasingPct = (stats.leasing / stats.os) * 100;
    document.getElementById("os_progress_cash").style.width = cashPct + "%";
    document.getElementById("os_progress_leasing").style.width = leasingPct + "%";

    // UPDATE TVC
    document.getElementById("tvc_total").innerText = tvc.total;
    document.getElementById("tvc_gi").innerText = tvc.gi;
    document.getElementById("tvc_belum").innerText = tvc.total - tvc.gi;

    // RENDER CHARTS
    renderAgingChart(aging);
    renderDonutChart(stats.cash, stats.leasing);
    
    // RENDER LISTS
    renderList("top_salesman", Object.entries(salesMap).sort((a,b)=>b[1]-a[1]).slice(0,5));
    renderList("top_overdue", ovArray.sort((a,b)=>b.val-a.val).slice(0,5), true);
    renderList("top_spv", Object.entries(spvMap).sort((a,b)=>b[1]-a[1]).slice(0,5));

    // RENDER LEASING BREAKDOWN
    let lHtml = '';
    Object.entries(leasingBreakdown).sort((a,b)=>b[1]-a[1]).forEach(([name, val])=>{
        let pct = ((val/stats.leasing)*100).toFixed(1);
        lHtml += `<div class="row"><span>${name}</span> <div><strong>${pct}%</strong> <small>${rupiah(val)}</small></div></div>`;
    });
    document.getElementById("leasing_breakdown").innerHTML = lHtml;
}

function renderList(targetId, arr, isOverdue = false) {
    let html = '';
    arr.forEach(item => {
        let name = isOverdue ? item.name : item[0];
        let val = isOverdue ? item.val : item[1];
        if(!name || name === "undefined") name = "Unknown";
        html += `<div class="row"><span>${name}</span><strong>${rupiah(val)}</strong></div>`;
    });
    document.getElementById(targetId).innerHTML = html;
}
// ... (tambahkan fungsi renderAgingChart & renderDonutChart dari versi sebelumnya)
loadDashboard();