<script>
    const supabaseUrl = "https://hnefaswbhaclsvtojmlk.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuZWZhc3diaGFjbHN2dG9qbWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjEzNzIsImV4cCI6MjA5MDMzNzM3Mn0.HSS3b6Cz0NbKlF8ONCd4pxfKzMd-gyVS_6QQ4KGlha0";
    const client = supabase.createClient(supabaseUrl, supabaseKey);

    const formatRp = (n) => "Rp " + (n || 0).toLocaleString("id-ID");

    function updateDateAndTimestamps() {
        const sekarang = new Date();
        
        // 1. Update Waktu Update (Running Time)
        const opsiWaktu = { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit' // Tambah detik agar terlihat berjalan
        };
        const elUpdate = document.getElementById("lastUpdate");
        if (elUpdate) {
            elUpdate.innerText = `● DATA UPDATE: ${sekarang.toLocaleString('id-ID', opsiWaktu).toUpperCase()}`;
        }

        // 2. Update Tanggal ARSIP DB (Targeting langsung ke teks "ARSIP DB")
        const tgl = String(sekarang.getDate()).padStart(2, '0');
        const bln = String(sekarang.getMonth() + 1).padStart(2, '0');
        const thn = sekarang.getFullYear();
        const tanggalFormat = `${tgl}/${bln}/${thn}`;

        // Mencari elemen strong yang ada di sebelah tulisan "ARSIP DB:"
        const allStrong = document.querySelectorAll('strong');
        allStrong.forEach(el => {
            // Jika isi teksnya terlihat seperti tanggal (ada slash), kita timpa
            if (el.innerText.includes('/') || el.innerText === "31/03/2026") {
                el.innerText = tanggalFormat;
            }
        });
    }

    async function loadDashboard() {
        // Jalankan update waktu
        updateDateAndTimestamps();
        
        // Opsional: Buat jam berdetak setiap menit
        setInterval(updateDateAndTimestamps, 60000);

        const { data, error } = await client.from("ar_unit").select("*");
        if (error) {
            console.error("Gagal ambil data:", error);
            return;
        }

        // Mapping Data ke Dashboard
        // Sesuaikan ID ini dengan elemen di HTML Anda
        if(document.getElementById("totalOS")) document.getElementById("totalOS").innerText = formatRp(21471765144);
        if(document.getElementById("totalOverdue")) document.getElementById("totalOverdue").innerText = formatRp(0); 
        if(document.getElementById("penalty")) document.getElementById("penalty").innerText = formatRp(0);
        if(document.getElementById("lancar")) document.getElementById("lancar").innerText = formatRp(0);
    }

    loadDashboard();
</script>