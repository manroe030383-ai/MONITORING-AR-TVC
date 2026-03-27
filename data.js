const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTjNg8b8zSmDd2oOO7FGzeIttLstq4azmEjOGLnXHLOyt4FlBykKYIEFe160BMLnjajbdUPeoAmiQu-/pub?gid=0&single=true&output=csv";

async function getData() {
    try {

        const res = await fetch(sheetURL);
        const text = await res.text();

        const rows = text.trim().split("\n").slice(1);

        return rows.map(row => {

            const col = row.split(",");

            return {
                customer: col[0] ? col[0].trim() : "",
                sales: col[1] ? Number(col[1].replace(/[^0-9]/g, "")) : 0,
                balance: col[2] ? Number(col[2].replace(/[^0-9]/g, "")) : 0,
                unit: col[3] ? col[3].trim() : ""
            }

        });

    } catch (error) {

        console.log("Error ambil data:", error);
        return [];

    }
}