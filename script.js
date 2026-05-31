import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabase = createClient('https://ozcrikgzsadezarhccvp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8');

const cleanNum = (v) => Number(String(v).replace(/[^0-9.-]+/g, "")) || 0;

async function fetchData() {
    const { data, error } = await supabase.from('ar_unit').select('*');
    if (error) { console.error("Error Supabase:", error); return; }

    if (data) {
        // --- 1. Header ---
        document.getElementById('status-update').innerText = "TERAKHIR DIPERBARUI: " + new Date().toLocaleTimeString('id-ID');
        document.getElementById('tgl-arsip').innerText = "31/5/2026"; // Sesuaikan jika ingin dinamis

        // --- 2. Kalkulasi Utama ---
        let totals = { os: 0, overdue: 0, cash: 0, leas: 0, unit_cash: 0, unit_leas: 0, penalty: 0 };
        
        data.forEach(d => {
            let os = cleanNum(d.os_balance);
            let ov = cleanNum(d.total_overdue);
            totals.os += os;
            totals.overdue += ov;
            
            const l = String(d.Leasing_Name || '').toUpperCase();
            if (l.includes('CASH')) { totals.cash += os; totals.unit_cash++; } 
            else { totals.leas += os; totals.unit_leas++; }
        });

        // --- 3. Update Dashboard Numbers ---
        document.getElementById('total-os').innerText = 'Rp ' + totals.os.toLocaleString('id-ID');
        document.getElementById('total-overdue').innerText = 'Rp ' + totals.overdue.toLocaleString('id-ID');
        document.getElementById('total-penalty').innerText = 'Rp ' + totals.penalty.toLocaleString('id-ID');
        document.getElementById('total-lancar').innerText = 'Rp ' + (totals.os - totals.overdue).toLocaleString('id-ID');
        
        // Update Progress Bar
        document.getElementById('bar-cash').style.width = ((totals.cash / (totals.os || 1)) * 100) + '%';
        document.getElementById('bar-leasing').style.width = ((totals.leas / (totals.os || 1)) * 100) + '%';
        
        // Update Breakdown Penjualan
        document.getElementById('val-total-cash').innerText = 'Rp ' + totals.cash.toLocaleString('id-ID');
        document.getElementById('unit-total-cash').innerText = totals.unit_cash + ' Unit';
        document.getElementById('val-total-leas').innerText = 'Rp ' + totals.leas.toLocaleString('id-ID');
        document.getElementById('unit-total-leas').innerText = totals.unit_leas + ' Unit';

        // --- 4. Populate Lists ---
        // Top 5 Overdue
        const sortedOverdue = [...data].sort((a,b) => cleanNum(b.total_overdue) - cleanNum(a.total_overdue)).slice(0, 5);
        document.getElementById('list-overdue').innerHTML = sortedOverdue.map(d => `
            <div class="flex justify-between text-[10px]">
                <span class="font-bold text-slate-600 truncate w-32">${d.Customer_Name}</span>
                <span class="text-red-600 font-black">Rp ${cleanNum(d.total_overdue).toLocaleString()}</span>
            </div>
        `).join('');

        // Database Table
        document.getElementById('tab-database-body').innerHTML = data.map((d, i) => `
            <tr class="hover:bg-slate-50">
                <td class="p-4 text-center">${i+1}</td>
                <td class="p-4 font-bold">${d.Customer_Name}</td>
                <td class="p-4">${d.Leasing_Name}</td>
                <td class="p-4 text-right">Rp ${cleanNum(d.os_balance).toLocaleString()}</td>
                <td class="p-4 text-right">${d.h1_30 || 0}</td>
                <td class="p-4 text-right">${d.h31_60 || 0}</td>
                <td class="p-4 text-right">${d.h60_plus || 0}</td>
                <td class="p-4 text-right font-bold text-red-600">Rp ${cleanNum(d.total_overdue).toLocaleString()}</td>
            </tr>
        `).join('');
    }
}

document.addEventListener('DOMContentLoaded', fetchData);