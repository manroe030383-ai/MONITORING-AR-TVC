const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjNg8b8zSmDd2oOO7FGzeIttLstq4azmEjOGLnXHLOyt4FlBykKYIEFe160BMLnjajbdUPeoAmiQu-/pub?gid=0&single=true&output=csv";

async function getData(){

    const res = await fetch(sheetURL);
    const text = await res.text();

    const rows = text.split("\n").slice(1);

    return rows.map(row=>{
        const col = row.split(",");
        return {
            customer: col[0],
            sales: Number(col[1]),
            balance: Number(col[2]),
            unit: col[3]
        }
    });

}";

async function getData(){

    const res = await fetch(sheetURL);
    const text = await res.text();

    const rows = text.split("\n").slice(1);

    return rows.map(row=>{
        const col = row.split(",");
        return {
            customer: col[0],
            sales: Number(col[1]),
            balance: Number(col[2]),
            unit: col[3]
        }
    });

}