import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// ========================================================
// 1. KONFIGURASI SUPABASE
// ========================================================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';

const SUPABASE_KEY = 'YOUR_SUPABASE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let charts = { bar: null, donut: null };
let cachedData = [];

// ========================================================
// 2. FORMATTER
// ========================================================
const fmtIDR = (v) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(v || 0);

const fmtJuta = (v) =>
    (Number(v || 0) / 1000000).toFixed(1) + " Jt";

// ========================================================
// 3. HELPER AMBIL KOLOM
// ========================================================
function getProp(obj, key) {

    if (!obj) return undefined;

    if (obj[key] !== undefined) return obj[key];

    const cleanKey = key
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    for (let k in obj) {

        const cleanK = k
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        if (cleanK === cleanKey) {
            return obj[k];
        }
    }

    return undefined;
}

// ========================================================
// 4. FETCH DATA
// ========================================================
async function fetchData() {

    try {

        const { data, error } = await supabase
            .from('ar_unit')
            .select('*');

        if (error) throw error;

        cachedData = data || [];

        console.log("DATA SUPABASE:", cachedData);

        updateDashboard(cachedData);

    } catch (err) {

        console.error(err);

        alert("Gagal mengambil data: " + err.message);
    }
}

// ========================================================
// 5. UPDATE DASHBOARD
// ========================================================
function updateDashboard(data) {

    renderDataArUnitFull(data);

    renderTabDatabaseFull(data);
}

// ========================================================
// 6. RENDER INPUT AR UNIT
// ========================================================
function renderDataArUnitFull(data) {

    const el = document.getElementById('tab-ar-unit-body');

    if (!el) return;

    const currentPath = window.location.pathname.toLowerCase();

    const isTafsPage = currentPath.includes('tafs');

    const isAccPage = currentPath.includes('acc');

    const isLeasingView = isTafsPage || isAccPage;

    const filterAR = data.filter(d => {

        const leasing = String(
            getProp(d, 'chas_leasing') ||
            getProp(d, 'leasing_name') ||
            ''
        ).toUpperCase();

        if (isTafsPage) {
            return leasing.includes('TAFS');
        }

        if (isAccPage) {
            return leasing.includes('ACC');
        }

        return leasing.includes('TAFS') || leasing.includes('ACC');
    });

    if (filterAR.length === 0) {

        el.innerHTML = `
        <tr>
            <td colspan="8" class="p-4 text-center">
                Tidak ada data
            </td>
        </tr>
        `;

        return;
    }

    el.innerHTML = filterAR.map((d, i) => {

        const namaCustomer = String(
            getProp(d, 'customer_name') ||
            getProp(d, 'Customer Name') ||
            '-'
        );

        const noCustomer = String(
            getProp(d, 'no_customer') ||
            getProp(d, 'No Customer') ||
            '-'
        );

        const leasing = String(
            getProp(d, 'chas_leasing') ||
            getProp(d, 'leasing_name') ||
            '-'
        );

        const osBalance = Number(
            getProp(d, 'os_balance') ||
            getProp(d, 'O/S Balance') ||
            0
        );

        const ketCabang = String(
            getProp(d, 'ket_cabang') || ''
        );

        const planBayar = String(
            getProp(d, 'plan_bayar_leasing') || ''
        );

        const ketLeasing = String(
            getProp(d, 'ket_leasing') || ''
        );

        const idDOM = noCustomer.replace(/[^a-zA-Z0-9]/g, '_');

        return `
        <tr class="hover:bg-slate-50">

            <td class="p-3 text-center">
                ${i + 1}
            </td>

            <td class="p-3">
                <div class="font-bold">
                    ${namaCustomer}
                </div>

                <div class="text-[10px] text-slate-400">
                    NO CUSTOMER : ${noCustomer}
                </div>
            </td>

            <td class="p-3">
                ${leasing}
            </td>

            <td class="p-3 text-right">
                ${fmtIDR(osBalance)}
            </td>

            <td class="p-3">
                <input
                    type="text"
                    id="cabang-${idDOM}"
                    value="${ketCabang}"
                    class="border rounded px-2 py-1 w-full"
                    ${isLeasingView ? 'readonly' : ''}
                >
            </td>

            <td class="p-3">
                <input
                    type="text"
                    id="plan-${idDOM}"
                    value="${planBayar}"
                    class="border rounded px-2 py-1 w-full"
                    ${!isLeasingView ? 'readonly' : ''}
                >
            </td>

            <td class="p-3">
                <input
                    type="text"
                    id="ket-${idDOM}"
                    value="${ketLeasing}"
                    class="border rounded px-2 py-1 w-full"
                    ${!isLeasingView ? 'readonly' : ''}
                >
            </td>

            <td class="p-3 text-center">

                ${
                    isLeasingView
                    ?
                    `
                    <button
                        onclick="simpanCatatanLeasing('${noCustomer}')"
                        class="bg-emerald-500 text-white px-3 py-1 rounded"
                    >
                        Simpan
                    </button>
                    `
                    :
                    `
                    <button
                        onclick="simpanCatatan('${noCustomer}')"
                        class="bg-blue-500 text-white px-3 py-1 rounded"
                    >
                        Simpan
                    </button>
                    `
                }

            </td>

        </tr>
        `;

    }).join('');
}

// ========================================================
// 7. RENDER DATABASE
// ========================================================
function renderTabDatabaseFull(data) {

    const el = document.getElementById('tab-database-body');

    if (!el) return;

    el.innerHTML = data.map((d, i) => {

        const namaCustomer = getProp(d, 'customer_name') || '-';

        const noCustomer = getProp(d, 'no_customer') || '-';

        const leasing = getProp(d, 'leasing_name') || '-';

        const osBalance = Number(
            getProp(d, 'os_balance') || 0
        );

        return `
        <tr>

            <td class="p-3 text-center">
                ${i + 1}
            </td>

            <td class="p-3">
                ${namaCustomer}
            </td>

            <td class="p-3">
                ${noCustomer}
            </td>

            <td class="p-3">
                ${leasing}
            </td>

            <td class="p-3 text-right">
                ${fmtIDR(osBalance)}
            </td>

        </tr>
        `;

    }).join('');
}

// ========================================================
// 8. SIMPAN CABANG
// ========================================================
window.simpanCatatan = async function(noCustomer) {

    try {

        const idDOM = String(noCustomer)
            .replace(/[^a-zA-Z0-9]/g, '_');

        const inputCabang =
            document.getElementById(`cabang-${idDOM}`);

        if (!inputCabang) {

            alert("Input cabang tidak ditemukan");

            return;
        }

        const valCabang = inputCabang.value;

        console.log("UPDATE CABANG:", noCustomer);

        const { data, error } = await supabase
            .from('ar_unit')
            .update({
                ket_cabang: valCabang
            })
            .eq('no_customer', noCustomer)
            .select();

        if (error) {

            console.log(error);

            alert(error.message);

            return;
        }

        if (!data || data.length === 0) {

            alert("Data tidak berhasil diupdate");

            return;
        }

        alert("Keterangan cabang berhasil disimpan");

        fetchData();

    } catch (err) {

        console.log(err);

        alert("Error : " + err.message);
    }
}

// ========================================================
// 9. SIMPAN LEASING
// ========================================================
window.simpanCatatanLeasing = async function(noCustomer) {

    try {

        const idDOM = String(noCustomer)
            .replace(/[^a-zA-Z0-9]/g, '_');

        const inputPlan =
            document.getElementById(`plan-${idDOM}`);

        const inputKet =
            document.getElementById(`ket-${idDOM}`);

        if (!inputPlan || !inputKet) {

            alert("Input leasing tidak ditemukan");

            return;
        }

        const valPlan = inputPlan.value;

        const valKet = inputKet.value;

        console.log("UPDATE LEASING:", noCustomer);

        const { data, error } = await supabase
            .from('ar_unit')
            .update({
                plan_bayar_leasing: valPlan,
                ket_leasing: valKet
            })
            .eq('no_customer', noCustomer)
            .select();

        if (error) {

            console.log(error);

            alert(error.message);

            return;
        }

        if (!data || data.length === 0) {

            alert("Data leasing tidak berhasil diupdate");

            return;
        }

        alert("Data leasing berhasil disimpan");

        fetchData();

    } catch (err) {

        console.log(err);

        alert("Error : " + err.message);
    }
}

// ========================================================
// 10. DOWNLOAD EXCEL
// ========================================================
function downloadExcel() {

    if (!cachedData || cachedData.length === 0) {

        alert("Data kosong");

        return;
    }

    const rows = cachedData.map((d, i) => {

        return {

            No: i + 1,

            Customer: getProp(d, 'customer_name'),

            NoCustomer: getProp(d, 'no_customer'),

            Leasing: getProp(d, 'leasing_name'),

            OSBalance: getProp(d, 'os_balance'),

            KetCabang: getProp(d, 'ket_cabang'),

            PlanBayar: getProp(d, 'plan_bayar_leasing'),

            KetLeasing: getProp(d, 'ket_leasing')
        };
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'AR UNIT');

    XLSX.writeFile(
        wb,
        'AR_UNIT.xlsx'
    );
}

// ========================================================
// 11. INIT
// ========================================================
document.addEventListener('DOMContentLoaded', () => {

    fetchData();

    const btnDownload =
        document.getElementById('btn-download-excel');

    if (btnDownload) {

        btnDownload.addEventListener(
            'click',
            downloadExcel
        );
    }

    supabase
        .channel('realtime-ar-unit')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'ar_unit'
            },
            () => {

                console.log("Realtime Update");

                fetchData();
            }
        )
        .subscribe();
});