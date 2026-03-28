<script>

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjNg8b8zSmDd2oOO7FGzeIttLstq4azmEjOGLnXHLOyt4FlBykKYIEFe160BMLnjajbdUPeoAmiQu-/pub?gid=0&single=true&output=csv";

async function getSheetData(){

    const res = await fetch(SHEET_URL);
    const csv = await res.text();

    const rows = csv.trim().split("\n");

    const headers = rows[0].split(",");

    return rows.slice(1).map(row=>{

        const cols = row.split(",");

        let obj = {};

        headers.forEach((h,i)=>{

            obj[h.trim()] = (cols[i] || "").trim();

        });

        return obj;
    });

}

function toNumber(val){

    if(!val) return 0;

    return Number(
        val
        .replace(/"/g,"")
        .replace(/\r/g,"")
        .replace(/\n/g,"")
        .replace(/\./g,"")
        .replace(/,/g,"")
        .trim()
    ) || 0;
}

async function loadOS(){

    const data = await getSheetData();

    let totalOS = 0;

    data.forEach(row=>{

        totalOS += toNumber(row.os_balance);

    });

    console.log("TOTAL OS =", totalOS);

    document.getElementById("totalOS").innerHTML =
        "Rp " + totalOS.toLocaleString("id-ID");

}

loadOS();

</script>