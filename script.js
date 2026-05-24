import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm'

// ========================================================
// SUPABASE CONFIG
// ========================================================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';

const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// ========================================================
// GLOBAL VARIABLE
// ========================================================
let cachedData = [];

let charts = {
    bar: null,
    donut: null
};

// ========================================================
// FORMATTER
// ========================================================
const fmtIDR = (v) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(Number(v || 0));

const fmtJuta = (v) =>
    (Number(v || 0) / 1000000).toFixed(1) + ' Jt';

// ========================================================
// AMBIL KOLOM DINAMIS
// ========================================================
function getProp(obj, key) {

    if (!obj) return undefined;

    if (obj[key] !== undefined) {
        return obj[key];
    }

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
// FETCH DATA
// ========================================================
async function fetchData() {

    try {

        console.log('Mengambil data dari Supabase...');

        const { data, error } = await supabase
            .from('ar_unit')
            .select('*');

        if (error) {
            throw error;
        }

        console.log('DATA SUPABASE:', data);

        cachedData = data || [];

        if (!cachedData.length) {

            console.log('Data kosong');

            if (document.getElementById('status-update')) {

                document.getElementById('status-update').innerHTML =
                    'DATA SUPABASE KOSONG';
            }

            return;
        }

        updateDashboard(cachedData);

        if (document.getElementById('status-update')) {

            document.getElementById('status-update').innerHTML =
                'DATA BERHASIL DIMUAT';
        }

    } catch (err) {

        console.error('ERROR FETCH:', err);

        if (document.getElementById('status-update')) {

            document.getElementById('status-update').innerHTML =
                'GAGAL KONEK SUPABASE';
        }

        alert('Error fetch data : ' + err.message);
    }
}

// ========================================================
// UPDATE DASHBOARD
// ========================================================
function updateDashboard(data) {

    let totalOS = 0;

    let totalOverdue = 0;

    let totalLancar = 0;

    let totalPenalty = 0;

    data.forEach(d => {

        const os = Number(
            getProp(d, 'os_balance') ||
            getProp(d, 'O/S Balance') ||
            0
        );

        const h1 = Number(
            getProp(d, 'hari_1_30') ||
            getProp(d, 'Hari 1-30') ||
            0
        );

        const h2 = Number(
            getProp(d, 'hari_31_60') ||
            getProp(d, 'Hari 31-60') ||
            0
        );

        const h3 = Number(
            getProp(d, 'lebih_60_hari') ||
            getProp(d, 'Lebih 60 Hari') ||
            0
        );

        const penalty = Number(
            getProp(d, 'potensi_penalti') ||
            getProp(d, 'Potensi Penalti') ||
            0
        );

        const overdue = h1 + h2 + h3;

        const lancar =
            overdue === 0
                ? os
                : Math.max(os - overdue, 0);

        totalOS += os;

        totalOverdue += overdue;

        totalLancar += lancar;

        totalPenalty += penalty;
    });

    // ====================================================
    // UPDATE CARD
    // ====================================================
    if (document.getElementById('total-os')) {
        document.getElementById('total-os').innerHTML =
            fmtIDR(totalOS);
    }

    if (document.getElementById('total-overdue')) {
        document.getElementById('total-overdue').innerHTML =
            fmtIDR(totalOverdue);
    }

    if (document.getElementById('total-lancar')) {
        document.getElementById('total-lancar').innerHTML =
            fmtIDR(totalLancar);
    }

    if (document.getElementById('total-penalty')) {
        document.getElementById('total-penalty').innerHTML =
            fmtIDR(totalPenalty);
    }

    // ====================================================
    // RENDER TABLE
    // ====================================================
    renderDataArUnitFull(data);

    renderTabDatabaseFull(data);
}

// ========================================================
// RENDER TABLE AR UNIT
// ========================================================
function renderDataArUnitFull(data) {

    const el = document.getElementById('tab-ar-unit-body');

    if (!el) return;

    const currentPath =
        window.location.pathname.toLowerCase();

    const isTafsPage =
        currentPath.includes('tafs');

    const isAccPage =
        currentPath.includes('acc');

    const isLeasingView =
        isTafsPage || isAccPage;

    const filtered = data.filter(d => {

        const leasing = String(
            getProp(d, 'leasing_name') ||
            getProp(d, 'chas_leasing') ||
            ''
        ).toUpperCase();

        if (isTafsPage) {
            return leasing.includes('TAFS');
        }

        if (isAccPage) {
            return leasing.includes('ACC');
        }

        return (
            leasing.includes('TAFS') ||
            leasing.includes('ACC')
        );
    });

    if (!filtered.length) {

        el.innerHTML = `
        <tr>
            <td colspan="8" class="p-4 text-center">
                Tidak ada data
            </td>
        </tr>
        `;

        return;
    }

    el.innerHTML = filtered.map((d, i) => {

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
            getProp(d, 'leasing_name') ||
            getProp(d, 'chas_leasing') ||
            '-'
        );

        const os = Number(
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

        const domID = noCustomer.replace(/[^a-zA-Z0-9]/g, '_');

        return `
        <tr class="hover:bg-slate-50 uppercase font-bold">

            <td class="p-3 text-center">
                ${i + 1}
            </td>

            <td class="p-3">
                <div class="font-black">
                    ${namaCustomer}
                </div>

                <div class="text-[10px] text-slate-400">
                    ${noCustomer}
                </div>
            </td>

            <td class="p-3">
                ${leasing}
            </td>

            <td class="p-3 text-right text-blue-600">
                ${fmtIDR(os)}
            </td>

            <td class="p-3">
                <input
                    type="text"
                    id="cabang-${domID}"
                    value="${ketCabang}"
                    class="border rounded px-2 py-1 w-full"
                    ${isLeasingView ? 'readonly' : ''}
                >
            </td>

            <td class="p-3">
                <input
                    type="text"
                    id="plan-${domID}"
                    value="${planBayar}"
                    class="border rounded px-2 py-1 w-full"
                    ${!isLeasingView ? 'readonly' : ''}
                >
            </td>

            <td class="p-3">
                <input
                    type="text"
                    id="ket-${domID}"
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
// RENDER DATABASE TABLE
// ========================================================
function renderTabDatabaseFull(data) {

    const el = document.getElementById('tab-database-body');

    if (!el) return;

    el.innerHTML = data.map((d, i) => {

        const customer = getProp(d, 'customer_name') || '-';

        const noCustomer = getProp(d, 'no_customer') || '-';

        const leasing = getProp(d, 'leasing_name') || '-';

        const os = Number(
            getProp(d, 'os_balance') || 0
        );

        return `
        <tr>

            <td class="p-3 text-center">
                ${i + 1}
            </td>

            <td class="p-3">
                ${customer}
            </td>

            <td class="p-3">
                ${noCustomer}
            </td>

            <td class="p-3">
                ${leasing}
            </td>

            <td class="p-3 text-right">
                ${fmtIDR(os)}
            </td>

        </tr>
        `;

    }).join('');
}

// ========================================================
// SIMPAN CABANG
// ========================================================
window.simpanCatatan = async function(noCustomer) {

    try {

        const domID =
            String(noCustomer)
            .replace(/[^a-zA-Z0-9]/g, '_');

        const input =
            document.getElementById(`cabang-${domID}`);

        if (!input) {

            alert('Input cabang tidak ditemukan');

            return;
        }

        const value = input.value;

        const { data, error } = await supabase
            .from('ar_unit')
            .update({
                ket_cabang: value
            })
            .eq('no_customer', noCustomer)
            .select();

        if (error) {
            throw error;
        }

        if (!data || !data.length) {

            alert('Data tidak berhasil diupdate');

            return;
        }

        alert('Keterangan cabang berhasil disimpan');

        fetchData();

    } catch (err) {

        console.error(err);

        alert('Error simpan : ' + err.message);
    }
}

// ========================================================
// SIMPAN LEASING
// ========================================================
window.simpanCatatanLeasing = async function(noCustomer) {

    try {

        const domID =
            String(noCustomer)
            .replace(/[^a-zA-Z0-9]/g, '_');

        const plan =
            document.getElementById(`plan-${domID}`);

        const ket =
            document.getElementById(`ket-${domID}`);

        if (!plan || !ket) {

            alert('Input leasing tidak ditemukan');

            return;
        }

        const valPlan = plan.value;

        const valKet = ket.value;

        const { data, error } = await supabase
            .from('ar_unit')
            .update({
                plan_bayar_leasing: valPlan,
                ket_leasing: valKet
            })
            .eq('no_customer', noCustomer)
            .select();

        if (error) {
            throw error;
        }

        if (!data || !data.length) {

            alert('Data leasing tidak berhasil diupdate');

            return;
        }

        alert('Data leasing berhasil disimpan');

        fetchData();

    } catch (err) {

        console.error(err);

        alert('Error leasing : ' + err.message);
    }
}

// ========================================================
// DOWNLOAD EXCEL
// ========================================================
function downloadExcel() {

    if (!cachedData.length) {

        alert('Data kosong');

        return;
    }

    const rows = cachedData.map((d, i) => {

        return {

            No: i + 1,

            Customer:
                getProp(d, 'customer_name'),

            NoCustomer:
                getProp(d, 'no_customer'),

            Leasing:
                getProp(d, 'leasing_name'),

            OSBalance:
                getProp(d, 'os_balance'),

            KetCabang:
                getProp(d, 'ket_cabang'),

            PlanBayar:
                getProp(d, 'plan_bayar_leasing'),

            KetLeasing:
                getProp(d, 'ket_leasing')
        };
    });

    const ws =
        XLSX.utils.json_to_sheet(rows);

    const wb =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        wb,
        ws,
        'AR UNIT'
    );

    XLSX.writeFile(
        wb,
        'REPORT_AR_UNIT.xlsx'
    );
}

// ========================================================
// INIT
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

                console.log('Realtime update');

                fetchData();
            }
        )
        .subscribe();
});