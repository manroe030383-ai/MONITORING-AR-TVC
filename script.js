import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient('https://ozcrikgzsadezarhccvp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8');

const cleanNum = (v) => Number(String(v).replace(/[^0-9.-]+/g, "")) || 0;

async function fetchData() {
    const { data, error } = await supabase.from('ar_unit').select('*');
    if (error) { console.error(error); return; }

    if (data) {
        // 1. Update Header Status
        const now = new Date();
        document.getElementById('status-update').innerText = "TERAKHIR DIPERBARUI: " + now.toLocaleTimeString('id-ID');
        document.getElementById('tgl-arsip').innerText = now.toLocaleDateString('id-ID');
        
        // 2. Kalkulasi Data
        let s = { os: 0, ov: 0, cash: 0, leas: 0, lancar: 0, total_spk: data.length };
        
        data.forEach(d => {
            let os = cleanNum(d.os_balance);
            let ov = cleanNum(d.total_overdue);
            s.os += os;
            s.ov += ov;
            
            const l = String(d.Leasing_Name || '').toUpperCase();
            if (l.includes('CASH') || l === '') s.cash += os; 
            else s.leas += os;

            if (ov === 0) s.lancar += os;
        });

        // 3. Update Dashboard Overview
        document.getElementById('total-os').innerText = 'Rp ' + s.os.toLocaleString('id-ID');
        document.getElementById('total-overdue').innerText = 'Rp ' + s.ov.toLocaleString('id-ID');
        document.getElementById('total-lancar').innerText = 'Rp ' + s.lancar.toLocaleString('id-ID');
        document.getElementById('bar-cash').style.width = ((s.cash / (s.os || 1)) * 100) + '%';
        document.getElementById('bar-leasing').style.width = ((s.leas / (s.os || 1)) * 100) + '%';
        document.getElementById('badge-overdue').innerText = data.filter(d => cleanNum(d.total_overdue) > 0).length + " SPK LEWAT TOP";

        // 4. Render Table Database Lengkap
        document.getElementById('tab-database-body').innerHTML = data.map((d, i) => `
            <tr>
                <td class="p-4 text-center">${i+1}</td>
                <td class="p-4 font-bold">${d.Customer_Name}</td>
                <td class="p-4">${d.Leasing_Name}</td>
                <td class="p-4 text-right">Rp ${cleanNum(d.os_balance).toLocaleString()}</td>
                <td class="p-4 text-right">${d.hari_1_30 || 0}</td>
                <td class="p-4 text-right">${d.hari_31_60 || 0}</td>
                <td class="p-4 text-right">${d.lebih_60 || 0}</td>
                <td class="p-4 text-right font-bold text-red-600">Rp ${cleanNum(d.total_overdue).toLocaleString()}</td>
            </tr>
        `).join('');

        // 5. Render Tab Overdue
        document.getElementById('tab-overdue-full-list').innerHTML = data
            .filter(d => cleanNum(d.total_overdue) > 0)
            .map(d => `<div class="flex justify-between border-b pb-2"><span>${d.Customer_Name}</span><span class="font-bold text-red-600">Rp ${cleanNum(d.total_overdue).toLocaleString()}</span></div>`)
            .join('');
    }
}

document.addEventListener('DOMContentLoaded', fetchData);