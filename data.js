const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjNg8b8zSmDd2oOO7FGzeIttLstq4azmEjOGLnXHLOyt4FlBykKYIEFe160BMLnjajbdUPeoAmiQu-/pub?gid=0&single=true&output=csv";

async function getData() {
    const res = await fetch(sheetURL);
    const csv = await res.text();

    return new Promise((resolve) => {
        Papa.parse(csv, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {

                const data = results.data.map(row => ({
                    customer: row.Customer_Name,
                    sales: row.salesman_name,
                    supervisor: row.Supervisor_Name,
                    balance: Number(row.os_balance) || 0,
                    overdue1: Number(row.hari_1_30) || 0,
                    overdue2: Number(row.hari_31_60) || 0,
                    overdue3: Number(row.lebih_60_hari) || 0
                }));

                resolve(data);
            }
        });
    });
}