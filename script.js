import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
const supabase = createClient('https://ozcrikgzsadezarhccvp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y3Jpa2d6c2FkZXphcmhjY3ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzQxOTgsImV4cCI6MjA4ODcxMDE5OH0.vSohadwQZV2SU4bjXfh-bPGZ1FV6ivo4e0irF10ITn8');
const cleanNum = (v) => Number(String(v).replace(/[^0-9.-]+/g, "")) || 0;

async function fetchData() {
    const { data } = await supabase.from('ar_unit').select('*');
    if (data) {
        // Status & Waktu Live
        const now = new Date();
        document.getElementById('status-update').innerText = "DATA TERBARU: " + now.toLocaleTimeString('id-ID');
        document.getElementById('arsip-db-status').innerText = "ARSIP DB: " + now.toLocaleDateString('id-ID');
        
        // Update Ringkasan
        let s = { os: 0, ov: 0, cash: 0, leas: 0 };
        data.forEach(d => {
            s.os += cleanNum(d.os_balance); s.ov += cleanNum(d.total_overdue);
            const l = String(d.Leasing_Name || '').toUpperCase();
            if (l.includes('CASH') || l === '') s.cash += cleanNum(d.os_balance); else s.leas += cleanNum(d.os_balance);
        });
        document.getElementById('total-os').innerText = 'Rp ' + s.os.toLocaleString('id-ID');
        document.getElementById('total-overdue').innerText = 'Rp ' + s.ov.toLocaleString('id-ID');
        document.getElementById('bar-cash').style.width = ((s.cash / (s.os || 1)) * 100) + '%';
        document.getElementById('bar-leasing').style.width = ((s.leas / (s.os || 1)) * 100) + '%';

        // Render Tab Dinamis
        document.getElementById('tab-database-body').innerHTML = data.map((d,i) => `<tr><td class="p-3 border-b">${i+1}</td><td class="p-3 border-b font-bold">${d.Customer_Name}</td><td class="p-3 border-b">${d.Leasing_Name}</td><td class="p-3 border-b">Rp ${cleanNum(d.os_balance).toLocaleString()}</td></tr>`).join('');
        
        const lMap = data.reduce((a,d) => { a[d.Leasing_Name] = (a[d.Leasing_Name]||0) + cleanNum(d.os_balance); return a; }, {});
        document.getElementById('content-leasing').innerHTML = `<div class="bg-white p-6 rounded-2xl border card-shadow"><table class="w-full text-xs">${Object.entries(lMap).map(([k,v]) => `<tr><td class="p-3 border-b">${k}</td><td class="p-3 border-b font-bold">Rp ${v.toLocaleString()}</td></tr>`).join('')}</table></div>`;
        
        document.getElementById('content-overdue').innerHTML = `<div class="bg-white p-6 rounded-2xl border card-shadow"><table class="w-full text-xs">${data.filter(d => cleanNum(d.total_overdue)>0).map(d => `<tr><td class="p-3 border-b">${d.Customer_Name}</td><td class="p-3 border-b text-red-600 font-bold">Rp ${cleanNum(d.total_overdue).toLocaleString()}</td></tr>`).join('')}</table></div>`;
    }
}
document.addEventListener('DOMContentLoaded', fetchData);