<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script>
const sheetCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjNg8b8zSmDd2oOO7FGzeIttLstq4azmEjOGLnXHLOyt4FlBykKYIEFe160BMLnjajbdUPeoAmiQu-/pub?gid=0&single=true&output=csv";

let allData = [];

async function loadSheetData() {
    return new Promise((resolve, reject) => {
        Papa.parse(sheetCsvUrl, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                allData = results.data;
                resolve();
            },
            error: function(err) {
                reject(err);
            }
        });
    });
}

async function login(e){
    e.preventDefault();

    const username = document.querySelector("input[type='text']").value.trim().toLowerCase();
    const password = document.querySelector("input[type='password']").value.trim();
    const alertBox = document.querySelector(".alert-danger");
    alertBox.style.display = "none";

    let role = "";
    if(username === "admin" && password === "admin123") role = "Admin";
    else if(username === "tafs" && password === "tafs123") role = "TAFS";
    else if(username === "acc" && password === "acc123") role = "ACC";
    else { alertBox.style.display = "flex"; return false;}

    await loadSheetData();

    document.getElementById("loginSection").style.display = "none";
    document.getElementById("dashboardSection").style.display = "block";
    document.getElementById("dashboardTitle").textContent = `Dashboard ${role}`;

    renderFilteredData(role);
    return false;
}

function renderFilteredData(role){
    const table = document.getElementById("dashboardTable");
    table.innerHTML = "";

    let trHeader = document.createElement("tr");
    const keys = Object.keys(allData[0] || {});
    keys.forEach(key => {
        let th = document.createElement("th");
        th.textContent = key;
        trHeader.appendChild(th);
    });
    table.appendChild(trHeader);

    let filtered = allData.filter(row => {
        if(role === "Admin") return true;
        if(role === "TAFS") return row.salesman_name && row.salesman_name.toLowerCase().includes("tafs");
        if(role === "ACC") return row.salesman_name && row.salesman_name.toLowerCase().includes("acc");
        return false;
    });

    filtered.forEach(row => {
        let tr = document.createElement("tr");
        keys.forEach(key => {
            let td = document.createElement("td");
            td.textContent = row[key] ?? "";
            tr.appendChild(td);
        });
        table.appendChild(tr);
    });
}
</script>