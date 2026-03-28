const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjNg8b8zSmDd2oOO7FGzeIttLstq4azmEjOGLnXHLOyt4FlBykKYIEFe160BMLnjajbdUPeoAmiQu-/pub?gid=0&single=true&output=csv";

async function fetchData() {
    const res = await fetch(sheetUrl);
    const data = await res.text();
    const rows = data.split("\n").map(r => r.split(","));
    return rows;
}

async function renderTable(tableId) {
    const rows = await fetchData();
    const table = document.getElementById(tableId);
    table.innerHTML = "";

    // header
    let header = document.createElement("tr");
    rows[0].forEach(h => {
        let th = document.createElement("th");
        th.textContent = h;
        header.appendChild(th);
    });
    table.appendChild(header);

    // data
    for(let i=1; i<rows.length; i++){
        let tr = document.createElement("tr");
        rows[i].forEach(cell => {
            let td = document.createElement("td");
            td.textContent = cell;
            tr.appendChild(td);
        });
        table.appendChild(tr);
    }
}