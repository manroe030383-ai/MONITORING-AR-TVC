/**
 * configs.js - Koneksi Database Supabase Pangkalan Bun
 * Masukkan file ini dalam folder yang sama dengan script.js Anda
 */

// Import library Supabase via CDN (Pastikan koneksi internet aktif)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// 1. Konfigurasi API Pangkalan Bun
const SUPABASE_URL = 'https://ahaoznkudusajtzfbnqj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoYW96bmt1ZHVzYWp0emZibnFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzQ0NTEsImV4cCI6MjA5MDgxMDQ1MX0.RbMEdiLooCsDKefdXnM_0jse63_C4sl1tWQ5BfWVU1s';

// 2. Inisialisasi Koneksi
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 3. Fungsi Helper Utama untuk Dashboard Pangkalan Bun
 * Fungsi ini digunakan untuk mengambil semua data AR Unit.
 */
export async function getPangkalanBunData() {
    try {
        // Ganti 'ar_unit' dengan nama tabel asli di database Supabase Anda
        const { data, error } = await supabase
            .from('ar_unit') 
            .select('*');

        if (error) {
            console.error("Gagal menarik data:", error.message);
            return null;
        }
        return data;
    } catch (err) {
        console.error("Kesalahan Sistem:", err);
        return null;
    }
}

/**
 * 4. Fungsi Format Mata Uang (Rupiah)
 * Agar angka di dashboard terlihat rapi (contoh: Rp 1.500.000)
 */
export const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(number);
};