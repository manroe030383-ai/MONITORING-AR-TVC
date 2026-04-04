const menuGroups = [
    { title: "MASTER PORTAL", items: [{ name: "Ekosistem Aplikasi", icon: "fa-th-large" }] },
    { title: "AR KENDARAAN (UNIT)", items: [
        { name: "Dashboard Unit", icon: "fa-chart-pie", active: true },
        { name: "Data AR Unit", icon: "fa-file-invoice" }
    ]},
    { title: "AR SERVICE GR", items: [{ name: "Dashboard GR", icon: "fa-tools" }] }
];

function renderSidebar() {
    const container = document.getElementById('sidebar-container');
    container.innerHTML = `
        <div class="p-6 border-b border-slate-800 mb-4">
            <h1 class="text-white font-black text-xl">BC <span class="text-[10px] text-slate-500 block">PANGKALAN BUN</span></h1>
        </div>
        <nav class="px-4 flex-1">
            ${menuGroups.map(group => `
                <div class="mb-6">
                    <p class="text-[9px] font-bold text-slate-600 mb-2 tracking-widest">${group.title}</p>
                    ${group.items.map(item => `
                        <button class="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs mb-1 ${item.active ? 'bg-red-600 text-white' : 'hover:bg-slate-800 text-slate-400'}">
                            <i class="fa-solid ${item.icon} w-4"></i> ${item.name}
                        </button>
                    `).join('')}
                </div>
            `).join('')}
        </nav>
        <div class="p-4 border-t border-slate-800">
            <button class="w-full py-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-lg border border-emerald-500/20">
                <i class="fa-solid fa-sync"></i> SYNC DATA AKTIF
            </button>
        </div>`;
}
renderSidebar();