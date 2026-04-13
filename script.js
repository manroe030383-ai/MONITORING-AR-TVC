import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// =============================
// KONFIGURASI SUPABASE
// =============================
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let donutChart
let barChart

// =============================
// FORMAT
// =============================
const formatIDR = (n) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(n || 0)

const formatJuta = (n) =>
    (Number(n) / 1000000).toFixed(1) + " Jt"


// =============================
// UPDATE TANGGAL
// =============================
function updateDateTime() {

    const now = new Date()

    const days = [
        'MINGGU',
        'SENIN',
        'SELASA',
        'RABU',
        'KAMIS',
        'JUMAT',
        'SABTU'
    ]

    const months = [
        'JANUARI',
        'FEBRUARI',
        'MARET',
        'APRIL',
        'MEI',
        'JUNI',
        'JULI',
        'AGUSTUS',
        'SEPTEMBER',
        'OKTOBER',
        'NOVEMBER',
        'DESEMBER'
    ]

    const time = now.getHours().toString().padStart(2, '0')
        + "."
        + now.getMinutes().toString().padStart(2, '0')

    document.getElementById('tgl-update-text').innerText =
        `DATA UPDATE: ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} - ${time} WIB`
}


// =============================
// LOAD DATA
// =============================
async function loadData() {

    try {

        const { data, error } =
            await supabase
                .from('ar_unit')
                .select('*')

        if (error) throw error

        processData(data)

    } catch (err) {

        console.error("ERROR:", err.message)

    }
}


// =============================
// PROCESS DATA
// =============================
function processData(data) {

    let totalOS = 0
    let totalOverdue = 0
    let totalPenalty = 0
    let belumJatuhTempo = 0

    let cashNominal = 0
    let leasingNominal = 0

    let cashUnit = 0
    let leasingUnit = 0

    const buckets = {
        'LANCAR': 0,
        '1-30 H': 0,
        '31-60 H': 0,
        '>60 H': 0
    }

    data.forEach(d => {

        const os = Number(d.os_balance) || 0
        const overdue = Number(d.total_overdue) || 0
        const penalty = Number(d.penalty_amount) || 0
        const aging = (d.status_aging || '').toUpperCase()
        const leasing = (d.leasing_name || '').toUpperCase()

        totalOS += os
        totalOverdue += overdue
        totalPenalty += penalty

        if (aging.includes("LANCAR"))
            belumJatuhTempo += os

        // CASH VS LEASING
        if (leasing === "CASH") {
            cashNominal += os
            cashUnit++
        } else {
            leasingNominal += os
            leasingUnit++
        }

        // AGING
        if (aging.includes("LANCAR"))
            buckets['LANCAR'] += os / 1000000
        else if (aging.includes("1-30"))
            buckets['1-30 H'] += os / 1000000
        else if (aging.includes("31-60"))
            buckets['31-60 H'] += os / 1000000
        else
            buckets['>60 H'] += os / 1000000

    })


    // =============================
    // KPI
    // =============================

    document.getElementById('total-os').innerText =
        formatIDR(totalOS)

    document.getElementById('total-overdue').innerText =
        formatIDR(totalOverdue)

    document.getElementById('total-penalty').innerText =
        formatIDR(totalPenalty)

    document.getElementById('total-lancar').innerText =
        formatIDR(belumJatuhTempo)


    const overdueCount =
        data.filter(d => Number(d.total_overdue) > 0).length

    document.getElementById('count-overdue').innerText =
        overdueCount + " Unit Terlambat"


    document.getElementById('val-total-cash').innerText =
        formatIDR(cashNominal)

    document.getElementById('unit-cash').innerText =
        cashUnit + " Unit"

    document.getElementById('val-total-leasing').innerText =
        formatIDR(leasingNominal)

    document.getElementById('unit-leasing').innerText =
        leasingUnit + " Unit"


    const totalUnit = cashUnit + leasingUnit

    document.getElementById('pct-cash').innerText =
        ((cashUnit / totalUnit) * 100).toFixed(1) + "%"

    document.getElementById('pct-leasing').innerText =
        ((leasingUnit / totalUnit) * 100).toFixed(1) + "%"


    // =============================
    // RENDER
    // =============================

    renderCharts(cashNominal, leasingNominal, Object.values(buckets))
    renderSalesList(data)
    renderOverdueList(data)
    renderTopSPV(data, totalOS)
    renderTVCBreakdown(data)
    renderLeasingBreakdown(data)

}


// =============================
// DONUT + AGING
// =============================
function renderCharts(cash, leasing, agingData) {

    if (donutChart) donutChart.destroy()
    if (barChart) barChart.destroy()

    donutChart = new ApexCharts(
        document.querySelector("#chart-donut-main"),
        {
            series: [cash, leasing],
            labels: ['Cash', 'Leasing'],
            chart: {
                type: 'donut',
                height: 230
            },
            colors: ['#10B981', '#422AFB'],
            legend: {
                position: 'bottom'
            }
        }
    )

    donutChart.render()


    barChart = new ApexCharts(
        document.querySelector("#chart-aging-nominal"),
        {
            series: [{
                name: 'Nominal',
                data: agingData
            }],
            chart: {
                type: 'bar',
                height: 350,
                toolbar: { show: false }
            },
            colors: [
                '#10B981',
                '#FFD700',
                '#FF8C00',
                '#EF4444'
            ],
            plotOptions: {
                bar: {
                    distributed: true,
                    borderRadius: 8
                }
            },
            xaxis: {
                categories: [
                    'LANCAR',
                    '1-30 H',
                    '31-60 H',
                    '>60 H'
                ]
            },
            dataLabels: {
                enabled: true,
                formatter: (v) =>
                    v.toFixed(1) + " Jt"
            }
        }
    )

    barChart.render()
}


// =============================
// TOP SALESMAN
// =============================
function renderSalesList(data) {

    const map = {}

    data.forEach(d => {

        const name = d.salesman_name || "UNKNOWN"

        if (!map[name])
            map[name] = 0

        map[name] += Number(d.os_balance) || 0
    })

    const sorted =
        Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)

    document.getElementById('list-salesman').innerHTML =
        sorted.map((s, i) => `
        <div class="flex justify-between">
            <span class="text-[10px] font-bold">${i + 1}. ${s[0]}</span>
            <span class="text-blue-600 font-bold">${formatJuta(s[1])}</span>
        </div>
    `).join('')
}


// =============================
// TOP OVERDUE
// =============================
function renderOverdueList(data) {

    const overdue =
        data
            .filter(d => Number(d.total_overdue) > 0)
            .sort((a, b) => b.total_overdue - a.total_overdue)
            .slice(0, 5)

    document.getElementById('list-overdue').innerHTML =
        overdue.map((d, i) => `
        <div class="flex justify-between">
            <div>
                <div class="text-[9px] font-bold">${i + 1}. ${d.customer_name}</div>
                <div class="text-red-500 text-[8px]">MAX ${d.hari_overdue} HARI</div>
            </div>
            <div class="text-red-600 font-bold">${formatJuta(d.total_overdue)}</div>
        </div>
    `).join('')
}


// =============================
// TOP SPV
// =============================
function renderTopSPV(data, totalOS) {

    const map = {}

    data.forEach(d => {

        const name = d.supervisor_name || "OTHERS"

        if (!map[name])
            map[name] = 0

        map[name] += Number(d.os_balance) || 0
    })

    const sorted =
        Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)

    document.getElementById('list-spv').innerHTML =
        sorted.map((s, i) => {

            const pct = (s[1] / totalOS) * 100

            return `
            <div>
                <div class="flex justify-between text-[9px]">
                    <span>${i + 1}. ${s[0]}</span>
                    <span>${formatJuta(s[1])}</span>
                </div>
                <div class="w-full bg-gray-100 h-1 rounded">
                    <div class="bg-purple-500 h-1 rounded"
                        style="width:${pct}%"></div>
                </div>
            </div>
        `
        }).join('')
}


// =============================
// TVC
// =============================
function renderTVCBreakdown(data) {

    const astra = ['ACC', 'TAFS']

    const tvc =
        data.filter(d =>
            astra.includes(
                (d.leasing_name || '').toUpperCase()
            )
        )

    const sudah =
        tvc.filter(d =>
            (d.status_tagih || '').toUpperCase() === 'SUDAH'
        ).length

    document.getElementById('list-tvc').innerHTML = `
        <div class="bg-blue-50 p-4 rounded-xl text-center">
            <div class="text-xs font-bold">TOTAL UNIT ASTRA</div>
            <div class="text-2xl font-black">${tvc.length}</div>
        </div>

        <div class="grid grid-cols-2 gap-3 mt-4">
            <div class="bg-emerald-50 p-3 text-center rounded">
                SUDAH GI
                <div class="font-bold">${sudah}</div>
            </div>

            <div class="bg-orange-50 p-3 text-center rounded">
                BELUM
                <div class="font-bold">${tvc.length - sudah}</div>
            </div>
        </div>
    `
}


// =============================
// LEASING BREAKDOWN
// =============================
function renderLeasingBreakdown(data) {

    const map = {}

    data.forEach(d => {

        const leasing = d.leasing_name || "OTHERS"

        if (!map[leasing])
            map[leasing] = 0

        map[leasing] += Number(d.os_balance) || 0
    })

    const sorted =
        Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)

    const max = sorted[0][1]

    document.getElementById('leasing-bars').innerHTML =
        sorted.map(l => `

        <div>

            <div class="flex justify-between text-[9px] font-bold mb-1">
                <span>${l[0]}</span>
                <span>${formatJuta(l[1])}</span>
            </div>

            <div class="w-full bg-slate-100 h-2 rounded-full">
                <div class="bg-blue-500 h-2 rounded-full"
                    style="width:${(l[1] / max) * 100}%">
                </div>
            </div>

        </div>

    `).join('')
}


// =============================
// INIT
// =============================

updateDateTime()
loadData()

setInterval(updateDateTime, 60000)
setInterval(loadData, 60000)