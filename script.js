<script type="module">
        import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

        // SINKRONISASI KREDENSIAL PORTAL AR UTAMA
        const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        let localDataStore = [];
        let chartAgingInstance = null;
        let chartDonutInstance = null;

        // HELPER FORMAT RUPIAH & JUTA
        const formatIDR = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

        // 1. MANAJEMEN NAVIGASI TAB
        window.filterTab = function(buttonElement, tabId) {
            try {
                document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
                
                const activeTab = document.getElementById(`content-${tabId}`);
                if (activeTab) activeTab.classList.remove('hidden');

                document.querySelectorAll('.nav-btn').forEach(btn => {
                    btn.classList.remove('nav-active');
                    btn.classList.add('bg-white', 'text-slate-500');
                });

                document.querySelectorAll('aside nav button').forEach(btn => {
                    btn.classList.remove('bg-red-600', 'text-white', 'shadow-lg', 'font-bold');
                    btn.classList.add('text-slate-400', 'font-medium');
                });

                if (buttonElement) {
                    if (buttonElement.id && buttonElement.id.startsWith('side-btn-')) {
                        buttonElement.classList.add('bg-red-600', 'text-white', 'shadow-lg', 'font-bold');
                        buttonElement.classList.remove('text-slate-400', 'font-medium');
                        
                        const topMatch = document.getElementById(`top-btn-${tabId}`);
                        if (topMatch) topMatch.classList.add('nav-active');
                    } else {
                        buttonElement.classList.add('nav-active');
                        buttonElement.classList.remove('bg-white', 'text-slate-500');
                        
                        const sideMatch = document.getElementById(`side-btn-${tabId}`);
                        if (sideMatch) {
                            sideMatch.classList.add('bg-red-600', 'text-white', 'shadow-lg', 'font-bold');
                            sideMatch.classList.remove('text-slate-400', 'font-medium');
                        }
                    }
                }
            } catch (err) {
                console.error("Navigasi mengalami hambatan runtime:", err);
            }
        }

        // UPDATE UPDATE HEADER STATUS TIME
        function updateHeaderStatus(isSuccess) {
            const statusIndicator = document.getElementById('status-update');
            const tglArsip = document.getElementById('tgl-arsip');
            
            if (statusIndicator) {
                if (isSuccess) {
                    statusIndicator.innerText = `DATA UPDATE: ${new Date().toLocaleString('id-ID')} WIB`;
                    statusIndicator.className = "text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1 italic";
                } else {
                    statusIndicator.innerText = "KONEKSI ATAU SKEMA GAGAL!";
                    statusIndicator.className = "text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1 italic";
                }
            }
            if (tglArsip && isSuccess) {
                const opsiTanggal = { year: 'numeric', month: 'short', day: 'numeric' };
                tglArsip.innerText = new Date().toLocaleDateString('id-ID', opsiTanggal).toUpperCase();
            }
        }

        // 2. AMBIL DATA DARI SUPABASE
        async function fetchDashboardDatabase() {
            const statusIndicator = document.getElementById('status-update');
            try {
                if (statusIndicator) statusIndicator.innerText = "MEMUAT DATA...";

                const { data, error } = await supabase.from('ar_unit').select('*').order('os_balance', { ascending: false });
                if (error) throw error;

                localDataStore = data || [];

                updateHeaderStatus(true);
                processAndRenderMetrics(localDataStore);
                renderTableARUnit(localDataStore);
                renderTableDatabaseLengkap(localDataStore);
                renderExtraDashboardLists(localDataStore);

            } catch (err) {
                console.error("Gagal sinkronisasi skema Supabase:", err);
                updateHeaderStatus(false);
                processAndRenderMetrics([]);
            }
        }

        // 3. AKSI SIMPAN DATA KE DATABASE (Sesuai Skema Riil Text/Null-Safe)
        window.saveRowChanges = async function(idRow) {
            try {
                const planValue = document.getElementById(`input-plan-${idRow}`).value;
                const ketValue = document.getElementById(`input-ket-${idRow}`).value;
                const cabangValue = document.getElementById(`input-cabang-${idRow}`).value;

                const { error } = await supabase
                    .from('ar_unit')
                    .update({
                        plan_bayar_leasing: planValue || null,
                        ket_leasing: ketValue || null,
                        ket_cabang: cabangValue || null
                    })
                    .eq('id', idRow);

                if (error) throw error;

                alert('Data AR Unit Berhasil Diperbarui!');
                fetchDashboardDatabase();

            } catch (err) {
                console.error("Gagal simpan data baris:", err);
                alert(`Gagal Menyimpan: ${err.message || err}`);
            }
        }

        // 4. PEMROSESAN METRIK DATA UTAMA
        function processAndRenderMetrics(data) {
            let totalOS = 0;
            let totalOverdue = 0;
            let overdueSPKCount = 0;
            let totalPenalty = 0;
            let penaltySPKCount = 0;
            let totalLancar = 0;

            let totalCashNominal = 0;
            let totalCashUnit = 0;
            let totalLeasingNominal = 0;
            let totalLeasingUnit = 0;

            let aging1_30 = 0;
            let aging31_60 = 0;
            let aging60Plus = 0;

            data.forEach(row => {
                const os = Number(row.os_balance || 0);
                const overdue = Number(row.total_overdue || 0);
                const penalty = Number(row.penalty_amount || 0);
                const lancar = Number(row.lancar || 0);

                totalOS += os;
                totalOverdue += overdue;
                totalPenalty += penalty;
                totalLancar += lancar;

                if (overdue > 0) overdueSPKCount++;
                if (penalty > 0) penaltySPKCount++;

                const lName = String(row.leasing_name || '').toUpperCase().trim();
                if (["CASH", "CASH TERIMA", ""].includes(lName)) {
                    totalCashNominal += os;
                    totalCashUnit++;
                } else {
                    totalLeasingNominal += os;
                    totalLeasingUnit++;
                }

                // SINKRONISASI KOLOM AGING DATABASE (Mendukung fallback underscore)
                aging1_30 += Number(row.hari_1_30 || row.hari_1_30_ || 0);
                aging31_60 += Number(row.hari_31_60 || row.hari_31_60_ || 0);
                aging60Plus += Number(row.lebih_60_hari || 0);
            });

            if (document.getElementById('total-os')) document.getElementById('total-os').innerText = formatIDR(totalOS);
            if (document.getElementById('total-overdue')) document.getElementById('total-overdue').innerText = formatIDR(totalOverdue);
            if (document.getElementById('badge-overdue')) document.getElementById('badge-overdue').innerText = `${overdueSPKCount} SPK Lewat TOP`;
            if (document.getElementById('total-penalty')) document.getElementById('total-penalty').innerText = formatIDR(totalPenalty);
            if (document.getElementById('spk-penalty')) document.getElementById('spk-penalty').innerText = `${penaltySPKCount} SPK Berpotensi`;
            if (document.getElementById('total-lancar')) document.getElementById('total-lancar').innerText = formatIDR(totalLancar);

            if (document.getElementById('val-total-cash')) document.getElementById('val-total-cash').innerText = formatIDR(totalCashNominal);
            if (document.getElementById('unit-total-cash')) document.getElementById('unit-total-cash').innerText = `${totalCashUnit} Unit`;
            if (document.getElementById('val-total-leas')) document.getElementById('val-total-leas').innerText = formatIDR(totalLeasingNominal);
            if (document.getElementById('unit-total-leas')) document.getElementById('unit-total-leas').innerText = `${totalLeasingUnit} Unit`;

            const pctCash = totalOS > 0 ? (totalCashNominal / totalOS) * 100 : 0;
            const pctLeas = totalOS > 0 ? (totalLeasingNominal / totalOS) * 100 : 0;
            if (document.getElementById('bar-cash')) document.getElementById('bar-cash').style.width = `${pctCash}%`;
            if (document.getElementById('bar-leasing')) document.getElementById('bar-leasing').style.width = `${pctLeas}%`;

            initiateApexCharts(totalLancar, aging1_30, aging31_60, aging60Plus, totalCashNominal, totalLeasingNominal);
        }

        // 5. RENDER TABEL EDIT DATA AR UNIT (Penyesuaian Kolom customer_name)
        function renderTableARUnit(data) {
            const tbody = document.getElementById('table-arunit-body');
            if (!tbody) return;
            tbody.innerHTML = '';

            const filteredData = data.filter(row => {
                const l = String(row.leasing_name || '').toUpperCase();
                return l.includes('ACC') || l.includes('TAFS');
            });

            if (filteredData.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400 font-bold uppercase text-[10px]">Tidak ada data records penagihan ACC / TAFS tersedia.</td></tr>`;
                return;
            }

            filteredData.forEach((row, idx) => {
                // FALLBACK PENCARIAN PROPERTI NAMA CUSTOMER YANG VALID
                const namaCust = row.customer_name || row.nama_customer || row['Customer name'] || '-';
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50/80 transition-all border-b border-slate-50 font-bold uppercase text-[11px]";
                tr.innerHTML = `
                    <td class="p-3 text-slate-400 font-semibold">${idx + 1}</td>
                    <td class="p-3 text-slate-800 font-black">
                        <p>${namaCust}</p>
                        <p class="text-[8px] text-slate-400 font-bold mt-0.5">👤 SALES: ${row.salesman_name || 'OFFICE'}</p>
                    </td>
                    <td class="p-3"><span class="bg-blue-50 text-blue-600 font-extrabold px-2 py-0.5 rounded text-[10px]">${row.leasing_name || 'CASH'}</span></td>
                    <td class="p-3 text-blue-600 font-black">${formatIDR(row.os_balance || 0)}</td>
                    <td class="p-3"><input type="text" id="input-plan-${row.id}" class="input-custom" value="${row.plan_bayar_leasing || ''}" placeholder="Isi plan..."></td>
                    <td class="p-3"><input type="text" id="input-ket-${row.id}" class="input-custom" value="${row.ket_leasing || ''}" placeholder="Isi keterangan..."></td>
                    <td class="p-3"><input type="text" id="input-cabang-${row.id}" class="input-custom" value="${row.ket_cabang || ''}" placeholder="Ket cabang..."></td>
                    <td class="p-3 text-center">
                        <button onclick="saveRowChanges(${row.id})" class="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white p-1.5 rounded transition-all shadow-sm" title="Simpan Data">
                            💾
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // 6. RENDER TABEL DATABASE LENGKAP (Penyesuaian Kolom customer_name)
        function renderTableDatabaseLengkap(data) {
            const tbody = document.getElementById('table-database-body');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400 font-bold uppercase text-[10px]">Database lengkap kosong.</td></tr>`;
                return;
            }

            data.forEach((row, idx) => {
                const namaCust = row.customer_name || row.nama_customer || row['Customer name'] || '-';
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50/80 border-b border-slate-50 font-bold uppercase text-[11px] whitespace-nowrap";
                tr.innerHTML = `
                    <td class="p-3 text-slate-400 font-medium">${idx + 1}</td>
                    <td class="p-3 text-slate-800 font-black">${namaCust}</td>
                    <td class="p-3 text-slate-500 font-extrabold"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">${row.leasing_name || 'CASH'}</span></td>
                    <td class="p-3 text-blue-600 font-black">${formatIDR(row.os_balance || 0)}</td>
                    <td class="p-3 text-amber-500">${formatIDR(row.hari_1_30 || row.hari_1_30_ || 0)}</td>
                    <td class="p-3 text-orange-500">${formatIDR(row.hari_31_60 || row.hari_31_60_ || 0)}</td>
                    <td class="p-3 text-red-600">${formatIDR(row.lebih_60_hari || 0)}</td>
                    <td class="p-3 text-red-500 font-black">${formatIDR(row.total_overdue || 0)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // 7. RENDER LIST BREAKDOWN TAMBAHAN
        function renderExtraDashboardLists(data) {
            let mLeas = {}, mSales = {}, mSpv = {}, mOverdueTop = [];
            let tvcTotal = 0, tvcGi = 0, tvcDeliv = 0;
            let totalOS = 0;

            data.forEach(d => {
                const os = Number(d.os_balance || 0);
                const ov = Number(d.total_overdue || 0);
                totalOS += os;

                const l = (d.leasing_name || 'CASH').toUpperCase().trim();
                if (!["CASH", "CASH TERIMA", ""].includes(l)) {
                    mLeas[l] = (mLeas[l] || 0) + os;
                    if (l.includes('TAFS') || l.includes('ACC')) {
                        tvcTotal++;
                        if (d.status_tagih === 'SUDAH GI') tvcGi++;
                        else tvcDeliv++;
                    }
                }

                if (ov > 0) mOverdueTop.push(d);

                const finalSales = (d.salesman_name || "OFFICE").trim();
                const finalSpv = (d.supervisor_name || "OFFICE").trim();
                mSales[finalSales] = (mSales[finalSales] || 0) + os;
                mSpv[finalSpv] = (mSpv[finalSpv] || 0) + os;
            });

            if(document.getElementById('total-unit-tvc')) document.getElementById('total-unit-tvc').innerText = `${tvcTotal} Unit`;
            if(document.getElementById('unit-gi-tvc')) document.getElementById('unit-gi-tvc').innerText = `${tvcGi} Unit`;
            if(document.getElementById('unit-delivery-tvc')) document.getElementById('unit-delivery-tvc').innerText = `${tvcDeliv} Unit`;

            const leasContainer = document.getElementById('leasing-list');
            if (leasContainer) {
                leasContainer.innerHTML = '';
                Object.keys(mLeas).sort((a,b)=>mLeas[b]-mLeas[a]).slice(0, 3).forEach(k => {
                    const pct = totalOS > 0 ? ((mLeas[k] / totalOS) * 100).toFixed(1) : 0;
                    leasContainer.innerHTML += `
                        <div>
                            <div class="flex justify-between text-[10px] mb-1 font-bold uppercase">
                                <span>${k}</span><span>${pct}%</span>
                            </div>
                            <div class="h-1 w-full bg-slate-100 rounded-full"><div class="bg-blue-600 h-full rounded-full" style="width: ${pct}%"></div></div>
                        </div>`;
                });
            }

            const tabLeasFull = document.getElementById('tab-leasing-full-list');
            if (tabLeasFull) {
                tabLeasFull.innerHTML = Object.keys(mLeas).sort((a,b)=>mLeas[b]-mLeas[a]).map(k => `
                    <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold uppercase">
                        <span class="text-slate-700">${k}</span>
                        <span class="text-blue-600 font-black">${formatIDR(mLeas[k])}</span>
                    </div>`).join('') || '<div class="text-slate-400 italic">Tidak ada kontribusi leasing ditemukan.</div>';
            }

            const salesContainer = document.getElementById('list-sales');
            if (salesContainer) {
                salesContainer.innerHTML = Object.entries(mSales).sort((a,b)=>b[1]-a[1]).slice(0, 5).map((item, i) => `
                    <div class="flex justify-between items-center text-[10px] uppercase font-bold py-2 border-b border-slate-50">
                        <span class="text-slate-600 truncate max-w-[130px]">${i+1}. ${item[0]}</span>
                        <span class="text-blue-600 font-black">${(item[1]/1000000).toFixed(1)} Jt</span>
                    </div>`).join('');
            }

            const spvContainer = document.getElementById('list-spv');
            if (spvContainer) {
                spvContainer.innerHTML = Object.entries(mSpv).sort((a,b)=>b[1]-a[1]).slice(0, 4).map((item, i) => `
                    <div class="mb-3 uppercase font-bold">
                        <div class="flex justify-between text-[10px] mb-1"><span>${i+1}. ${item[0]}</span><span class="text-purple-600 font-black">${(item[1]/1000000).toFixed(1)} Jt</span></div>
                        <div class="h-1 w-full bg-slate-50 rounded-full"><div class="bg-purple-500 h-full rounded-full" style="width: 100%"></div></div>
                    </div>`).join('');
            }

            // RENDER OVERDUE TOP 5 & FULL VIEW LIST OVERDUE
            const overdueContainer = document.getElementById('list-overdue');
            if (overdueContainer) {
                overdueContainer.innerHTML = mOverdueTop.sort((a,b)=>b.total_overdue - a.total_overdue).slice(0, 5).map((d, i) => {
                    const name = d.customer_name || d.nama_customer || d['Customer name'] || '-';
                    return `
                    <div class="flex justify-between items-center text-[10px] uppercase font-bold py-2 border-b border-slate-50">
                        <span class="text-slate-600 truncate max-w-[130px]">${i+1}. ${name}</span>
                        <span class="text-red-500 font-black">${(d.total_overdue/1000000).toFixed(1)} Jt</span>
                    </div>`;
                }).join('');
            }

            const tabOverdueFullList = document.getElementById('tab-overdue-list');
            if (tabOverdueFullList) {
                if (mOverdueTop.length === 0) {
                    tabOverdueFullList.innerHTML = `<p class="p-4 text-center text-slate-400 italic">Tidak ada rekaman data Overdue Unit.</p>`;
                } else {
                    tabOverdueFullList.innerHTML = `
                    <div class="space-y-3 p-1">
                        ${mOverdueTop.map((d) => {
                            const name = d.customer_name || d.nama_customer || d['Customer name'] || '-';
                            return `
                            <div class="bg-white border border-slate-100 rounded-xl p-4 flex justify-between items-center shadow-sm hover:shadow-md transition-all font-bold uppercase text-xs">
                                <div>
                                    <p class="text-slate-800 text-[12px] font-black tracking-wide">${name}</p>
                                    <p class="text-[9px] text-slate-400 mt-1">Leasing: <span class="text-slate-600 font-extrabold">${d.leasing_name || 'CASH'}</span></p>
                                </div>
                                <div class="text-right">
                                    <p class="text-red-600 text-[13px] font-black">${formatIDR(d.total_overdue)}</p>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>`;
                }
            }
        }

        // 8. INITIALIZE CHARTS (APEX CHARTS RE-RENDER CONTROL)
        function initiateApexCharts(lancar, h1_30, h31_60, h60Plus, nominalCash, nominalLeas) {
            const vLancar = Math.round(lancar / 1000000);
            const v30 = Math.round(h1_30 / 1000000);
            const v60 = Math.round(h31_60 / 1000000);
            const vPlus = Math.round(h60Plus / 1000000);

            // AGING BAR CHART
            const barOptions = {
                series: [{ name: 'Nominal (Juta)', data: [vLancar, v30, v60, vPlus] }],
                chart: { type: 'bar', height: 180, toolbar: { show: false } },
                colors: ['#3B82F6'],
                plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '40%' } },
                dataLabels: { enabled: false },
                xaxis: { 
                    categories: ['LANCAR', '1-30 HARI', '31-60 HARI', '>60 HARI'],
                    labels: { style: { fontSize: '9px', fontWeight: 700, colors: '#1B2559' } }
                },
                yaxis: { labels: { formatter: function(v) { return 'Rp ' + v + ' Jt'; }, style: { fontSize: '9px' } } }
            };

            if (chartAgingInstance) {
                chartAgingInstance.updateOptions(barOptions);
            } else {
                const elBar = document.querySelector("#chart-aging");
                if (elBar) { chartAgingInstance = new ApexCharts(elBar, barOptions); chartAgingInstance.render(); }
            }

            // LEASING COMPOSITION DONUT
            const donutOptions = {
                series: [nominalCash, nominalLeas],
                labels: ['CASH', 'LEASING'],
                chart: { type: 'donut', height: 170 },
                legend: { show: false },
                dataLabels: { enabled: false },
                colors: ['#34D399', '#2563EB'],
                plotOptions: { pie: { donut: { size: '65%' } } }
            };

            if (chartDonutInstance) {
                chartDonutInstance.updateOptions(donutOptions);
            } else {
                const elDonut = document.querySelector("#chart-donut-leasing");
                if (elDonut) { chartDonutInstance = new ApexCharts(elDonut, donutOptions); chartDonutInstance.render(); }
            }
        }

        // LOAD FIRST TIME RUNTIME
        document.addEventListener('DOMContentLoaded', () => {
            fetchDashboardDatabase();
        });
    </script>