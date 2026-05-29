async function fetchData() {
    console.log("Fungsi fetchData dipanggil..."); // Tambahkan ini
    try {
        const { data, error } = await supabase.from('ar_unit').select('*');
        
        if (error) {
            console.error("Error dari Supabase:", error); // Error akan muncul di console
            return;
        }
        
        console.log("Data berhasil diambil:", data); // Pastikan ini muncul
        if (data && data.length > 0) {
            updateDashboard(data);
        } else {
            console.warn("Data kosong atau tidak ditemukan.");
        }
    } catch (e) {
        console.error("Error tak terduga:", e);
    }
}