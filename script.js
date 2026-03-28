<script>

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjNg8b8zSmDd2oOO7FGzeIttLstq4azmEjOGLnXHLOyt4FlBykKYIEFe160BMLnjajbdUPeoAmiQu-/pub?gid=0&single=true&output=csv";

async function getSheetData(){

    const res = await fetch(SHEET_URL);
    const csv = await res.text();

    const rows = csv.split("\n").map(r=>r.split(","));
    const headers = rows[0];

    return rows.slice(1).map(r=>{
        let obj={};
        headers.forEach((h,i)=>obj[h.trim()] = r[i]);
        return obj;
    });
}

function toNumber(val){

    if(!val) return 0;

    return Number(
        val.replace(/\./g,"")
           .replace(/,/g,"")
           .trim()
    ) || 0;
}

window.onload = async function(){

    const data = await getSheetData();

    let totalOS = 0;
    let totalOverdue = 0;
    let totalPenalty = 0;

    let cashOS = 0;
    let leasingOS = 0;

    let aging = {
        lancar:0,
        a30:0,
        a60:0,
        a60p:0
    };

    data.forEach(row=>{

        let os = toNumber(row.os_balance);
        let overdue = toNumber(row.total_overdue);
        let penalty = toNumber(row.Penalty_Amount);

        let lancar = toNumber(row.lancar);
        let a30 = toNumber(row.hari_1_30);
        let a60 = toNumber(row.hari_31_60);
        let a60p = toNumber(row.lebih_60_hari);

        totalOS += os;
        totalOverdue += overdue;
        totalPenalty += penalty;

        aging.lancar += lancar;
        aging.a30 += a30;
        aging.a60 += a60;
        aging.a60p += a60p;

        if(row.Metode_Pembayaran == "CASH")
            cashOS += os;
        else
            leasingOS += os;

    });

    // ================= CARD =================

    document.getElementById("totalOS").innerHTML =
        "Rp " + totalOS.toLocaleString("id-ID");

    document.getElementById("totalOverdue").innerHTML =
        "Rp " + totalOverdue.toLocaleString("id-ID");

    document.getElementById("penalty").innerHTML =
        "Rp " + totalPenalty.toLocaleString("id-ID");

    // ================= AGING =================

    new ApexCharts(document.querySelector("#chart-aging"),{

        series:[{
            data:[
                aging.lancar/1000000,
                aging.a30/1000000,
                aging.a60/1000000,
                aging.a60p/1000000
            ]
        }],

        chart:{ type:'bar', height:180 },

        colors:[
            '#10B981',
            '#FBBF24',
            '#F97316',
            '#EF4444'
        ],

        xaxis:{
            categories:[
                'LANCAR',
                '1-30 HR',
                '31-60 HR',
                '>60 HR'
            ]
        }

    }).render();

    // ================= DONUT =================

    new ApexCharts(document.querySelector("#chart-donut"),{

        series:[cashOS, leasingOS],

        chart:{ type:'donut', height:180 },

        labels:['Cash','Leasing'],

        colors:['#10B981','#3B82F6']

    }).render();

};

</script>