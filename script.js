const SUPABASE_URL = "https://ahaoznkudusajtzfbnqj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const rupiah = (n) => "Rp " + (n || 0).toLocaleString("id-ID");

async function loadDashboard() {

    document.getElementById("loading").style.display = "block";

    const { data, error } = await client
        .from("ar_unit")
        .select("*");

    document.getElementById("loading").style.display = "none";

    if (error) {
        alert("Error Supabase");
        return;
    }

    let totalOS = 0;
    let totalOverdue = 0;
    let totalPenalty = 0;
    let belumTempo = 0;

    let aging = { lancar:0, h1:0, h31:0, h60:0 };

    let salesman = {};
    let spv = {};
    let leasing = {};

    let topOverdue = [];

    let tvcTotal = data.length;
    let tvcGI = 0;

    data.forEach(d => {

        let os = Number(d.os_balance) || 0;
        let overdue = Number(d.total_overdue) || 0;
        let penalty = Number(d.Penalty_Amount) || 0;

        totalOS += os;
        totalOverdue += overdue;
        totalPenalty += penalty;

        if(overdue === 0) belumTempo += os;

        aging.lancar += Number(d.lancar) || 0;
        aging.h1 += Number(d.hari_1_30) || 0;
        aging.h31 += Number(d.hari_31_60) || 0;
        aging.h60 += Number(d.lebih_60_hari) || 0;

        let s = d.salesman_name || "Unknown";
        salesman[s] = (salesman[s] || 0) + os;

        let p = d.Supervisor_Name || "Unknown";
        spv[p] = (spv[p] || 0) + os;

        let l = d.Leasing_Name || "Unknown";
        leasing[l] = (leasing[l] || 0) + os;

        if(d.GI_Date) tvcGI++;

        if(overdue > 0){
            topOverdue.push({
                name: d.Customer_Name,
                value: overdue
            });
        }

    });

    document.getElementById("total_os").innerText = rupiah(totalOS);
    document.getElementById("total_overdue").innerText = rupiah(totalOverdue);
    document.getElementById("total_penalty").innerText = rupiah(totalPenalty);
    document.getElementById("belum_tempo").innerText = rupiah(belumTempo);

    document.getElementById("tvc_total").innerText = tvcTotal;
    document.getElementById("tvc_gi").innerText = tvcGI;
    document.getElementById("tvc_belum").innerText = tvcTotal - tvcGI;

    document.getElementById("update_time").innerText =
        new Date().toLocaleString("id-ID");

    new ApexCharts(
        document.querySelector("#agingChart"),
        {
            chart:{type:"bar"},
            series:[{
                data:[
                    aging.lancar,
                    aging.h1,
                    aging.h31,
                    aging.h60
                ]
            }],
            xaxis:{
                categories:[
                    "Lancar",
                    "1-30",
                    "31-60",
                    ">60"
                ]
            }
        }
    ).render();

}

loadDashboard();