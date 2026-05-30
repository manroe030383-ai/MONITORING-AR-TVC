import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://ozcrikgzsadezarhccvp.supabase.co'; // Sudah diperbaiki
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper pembersih data
const cleanNum = (val) => Number(String(val).replace(/[^0-9.-]+/g, "")) || 0;

async function fetchData() {
    try {
        const { data, error } = await supabase
            .from('ar_unit')
            .select('*')
            .range(0, 5000);

        if (error) throw error;

        updateDashboard(data || []);
        renderTables(data || []);
        console.log("Data berhasil dimuat:", data.length, "baris");
    } catch (e) {
        console.error("Gagal ambil data:", e);
    }
}

function updateDashboard(data) {
    let s = { os: 0, ov: 0, penalti: 0, lancar: 0, cash: 0, leas: 0, countCash: 0, countLeas: 0 };

    data.forEach(d => {
        const os = cleanNum(d.os_balance);
        const ov = cleanNum(d.total_overdue);
        const pen = cleanNum(d.Penalty_Amount);
        const lancar = cleanNum(d.lancar);
        const leasing = String(d.Leasing_Name || '').toUpperCase();

        s.os += os;
        s.ov += ov;
        s.penalti += pen;
        s.lancar += lancar;

        if (leasing.includes('CASH') || leasing === '') {
            s.cash += os;
            s.countCash++;
        } else {
            s.leas += os;
            s.countLeas++;
        }
    });

    // Update UI berdasarkan ID HTML Anda
    document.getElementById('total-os').innerText = 'Rp ' + s.os.toLocaleString('id-ID');
    document.getElementById('total-overdue').innerText = 'Rp ' + s.ov.toLocaleString('id-ID');
    document.getElementById('total-penalty').innerText = 'Rp ' + s.penalti.toLocaleString('id-ID');
    document.getElementById('total-lancar').innerText = 'Rp ' + s.lancar.toLocaleString('id-ID');
    
    document.getElementById('val-total-cash').innerText = 'Rp ' + s.cash.toLocaleString('id-ID');
    document.getElementById('unit-total-cash').innerText = s.countCash + ' Unit';
    
    document.getElementById('val-total-leas').innerText = 'Rp ' + s.leas.toLocaleString('id-ID');
    document.getElementById('unit-total-leas').innerText = s.countLeas + ' Unit';
    
    // Update progress bar
    const total = s.os || 1;
    document.getElementById('bar-cash').style.width = ((s.cash / total) * 100) + '%';
    document.getElementById('bar-leasing').style.width = ((s.leas / total) * 100) + '%';
}

function renderTables(data) {
    // Render Database Lengkap
    const dbBody = document.getElementById('tab-database-body');
    dbBody.innerHTML = data.map((d, i) => `
        <tr>
            <td class="p-4 text-center">${i + 1}</td>
            <td class="p-4 font-bold">${d.Customer_Name}</td>
            <td class="p-4">${d.Leasing_Name}</td>
            <td class="p-4 text-right">${Number(d.os_balance).toLocaleString('id-ID')}</td>
            <td class="p-4 text-right">${Number(d.hari_1_30).toLocaleString('id-ID')}</td>
            <td class="p-4 text-right">${Number(d.hari_31_60).toLocaleString('id-ID')}</td>
            <td class="p-4 text-right">${Number(d.lebih_60_hari).toLocaleString('id-ID')}</td>
            <td class="p-4 text-right font-bold text-red-600">${Number(d.total_overdue).toLocaleString('id-ID')}</td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', fetchData);