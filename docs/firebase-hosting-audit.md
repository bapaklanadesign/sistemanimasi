# Audit Firebase Hosting — CV MR EXPRESS

## Status: belum siap deploy dengan seluruh fitur

Konfigurasi Hosting statis sudah ditambahkan, tetapi konfigurasi tersebut **bukan** konversi aplikasi menjadi SPA statis. Jangan menjalankan deploy produksi sebelum artefak dan koneksi layanan server tervalidasi.

## Penyebab utama

- `package.json`: `build` menjalankan `vite build`; aplikasi masih memakai `@tanstack/react-start`, dan `nitro` masih menjadi dependency build.
- `vite.config.ts`: wrapper `@lovable.dev/vite-tanstack-config` memasang TanStack Start serta Nitro secara otomatis; entry server diarahkan ke `src/server.ts`.
- Build yang diamati dalam audit menghasilkan `dist/client/assets` dan `dist/server`, bukan `dist/index.html` serta `dist/assets`.
- `dist/client` juga tidak memiliki `index.html`. Memindahkan aset atau mengubah nilai `hosting.public` saja tidak menyelesaikan masalah.
- Tidak ada `firebase.json` sebelum audit.

## Fungsi yang harus tetap aman

| Fungsi | Penggunaan | Status |
| --- | --- | --- |
| `getPublicTracking` di `src/lib/tracking.functions.ts` | Memanggil `public_track_packing_list` melalui service role dan hanya mengembalikan data tracking publik | Dipertahankan; belum dipindahkan |
| `verifyKoliScans` di `src/lib/koli-verify.functions.ts` | Memvalidasi sesi, membaca Packing List dengan RLS, mencocokkan scan secara deterministik, meminta ringkasan AI | Dipertahankan; belum dipindahkan |

RPC tracking hanya boleh dieksekusi oleh `service_role` menurut migration terbaru. Memanggilnya langsung dari browser akan gagal; membuka hak eksekusinya untuk anon bertentangan dengan batas akses yang berlaku. Service role maupun kunci AI tidak boleh ditempatkan di browser.

Pencocokan deterministik tersedia di `src/lib/koli-verify.ts`, tetapi memindahkannya saja ke browser tidak mempertahankan keseluruhan fungsi autentikasi dan ringkasan AI.

## Batas implementasi

Stack proyek yang didukung tetap TanStack Start. Bootstrap Start tidak boleh diganti menjadi aplikasi React/Vite lain, dan fungsi internal baru tidak boleh dipindahkan ke Supabase Edge Functions dalam proyek ini. Rencana awal memindahkan tracking ke RPC anon dan menjadikan AI opsional bukan solusi yang dapat diterapkan tanpa mengubah batas keamanan atau mengurangi fitur.

Pengguna telah menjelaskan bahwa belum ada server terpisah dan hanya ingin Supabase Edge Functions, tanpa menyediakan server eksternal baru. Pilihan ini belum dapat diimplementasikan di stack yang didukung editor ini; **tidak ada endpoint Edge Function yang dibuat atau dideploy**. URL project Supabase yang sudah terhubung adalah `https://nywokuprwanjuwbtunrc.supabase.co`, tetapi URL tersebut saja tidak membuat endpoint tracking atau AI tersedia. Tidak diperlukan perubahan URL Supabase atau database.

Alternatif teknis yang didukung editor adalah ekspor shell SPA statis untuk Firebase dengan layanan TanStack Start terpisah. Karena pengguna tidak memilih pendekatan tersebut, implementasi lanjutnya ditahan, bukan diterapkan diam-diam. Migrasi SPA murni + Edge Functions perlu dilakukan di lingkungan pengembangan eksternal yang mendukung konversi itu; ini bukan permintaan untuk menyewa server eksternal baru.

Selain itu, gambar kapal menggunakan pointer `/__l5e/assets-v1/...`. Jalur ini tidak disediakan Firebase Hosting. Media perlu disertakan dalam hasil ekspor statis atau dipetakan ke alamat media publik yang terverifikasi, tanpa mengubah desain.

## File yang diperbaiki / ditambahkan

- `firebase.json`: `public: "dist"`, rewrite semua halaman ke `/index.html`, tanpa konfigurasi SSR atau Cloud Functions; file keluaran server dikecualikan agar tidak ikut tersaji sebagai file publik.
- `src/test/firebase-hosting.test.ts`: memeriksa direktori publik dan fallback SPA yang diminta.
- `roadmap.md`: mencatat blocker migrasi penuh.
- `AGENTS.md`: mencatat batas pemisahan static hosting dan layanan server.
- Dokumen audit ini.

Tidak ada perubahan UI, autentikasi, role, Supabase, data, RLS, Storage, fitur Swarm, maupun fungsi tracking/AI.

## Validasi

- Build awal `bun run build` yang diamati selesai dengan exit code 0, tetapi menghasilkan output client/server yang tidak cocok dengan target Firebase statis.
- `npm install` dan `npm run build` **belum dijalankan** dalam perbaikan ini. Lingkungan editor menjalankan pemeriksaan build secara otomatis; build manual proyek tidak diizinkan di sini.
- `dist/index.html` dan `dist/assets` **belum tersedia / belum tervalidasi** sebagai hasil perbaikan.
- Belum dilakukan pemindaian secret pada bundle final Firebase karena bundle tersebut belum dihasilkan.
- Seluruh halaman SPA dan alur signed-in belum diuji pada Firebase.
- Tidak ada fungsi server yang dipindahkan, dan tidak ada deployment Firebase yang dilakukan.
- Tiga tes konfigurasi Firebase telah dijalankan dan lulus. Pemeriksaan build otomatis editor terbaru melaporkan `build OK`; ini memvalidasi proyek yang masih berbasis Start, bukan target SPA Firebase.
- Tes regresi keseluruhan yang dijalankan: **19 file, 134 tes lulus**. Ini tidak menggantikan validasi deployment Firebase atau alur signed-in dengan data nyata.

## Pemeriksaan dampak lintas fitur

Aturan yang dituju: semua halaman harus dapat digunakan dari Firebase Hosting statis, sementara seluruh rahasia dan hak akses tetap terlindungi.

| Bagian yang kode terkaitnya dibaca | Temuan untuk aturan tersebut |
| --- | --- |
| Root halaman, router, entry server, `src/start.ts`, konfigurasi Vite | Masih bergantung pada Start; output SPA belum dihasilkan |
| `/lacak/$token`, fungsi tracking, kedua migration RPC tracking | Masih memerlukan server; RPC terbaru dibatasi ke service role |
| `/scan-koli`, fungsi verifikasi, matcher scan | Pencocokan lokal dan penyimpanan scan menggunakan browser/Supabase; ringkasan AI dan pemeriksaan server tetap memerlukan server |
| `src/lib/auth.tsx`, client Supabase, bearer attacher, middleware autentikasi | Sesi dan role browser sudah memakai Supabase; autentikasi panggilan verifikasi server tetap diperlukan |
| `src/lib/users-api.ts` | Administrasi akun sudah memanggil RPC Supabase langsung; bukan alasan menambahkan server frontend baru |
| `src/lib/packing-data.ts`, `src/lib/data.ts` | Data packing/pembukuan memakai Supabase langsung; Realtime pembukuan berlangganan dari browser |
| Pointer gambar kapal dan pemakaiannya pada halaman login | Media masih memakai jalur aset hosting lama, belum dipaketkan untuk Firebase |

Pencarian penggunaan server juga menemukan RPC transaksi, transfer, rekening, impor, dan dialog edit/hapus langsung ke Supabase. Pencarian ini **bukan** verifikasi end-to-end seluruh halaman tersebut. Export PDF/Excel, upload dokumen, seluruh audit log, dan seluruh fungsi SQL belum diuji ulang di Firebase; tidak diklaim telah lolos. Tidak ada background job baru yang dibuat. Semua data termasuk transaksi yang sudah selesai tetap tidak diubah.

## Syarat selesai

1. Untuk pilihan pengguna (SPA murni + Supabase Edge Functions), melakukan konversi di lingkungan pengembangan eksternal yang mendukungnya; editor ini tetap mempertahankan stack Start.
2. Mendeploy endpoint tracking dan AI aman di backend yang dipilih, tanpa mengubah izin RPC tracking atau membocorkan kunci service role.
3. Menghasilkan dan memeriksa `dist/index.html`, `dist/assets`, dan seluruh media; jangan menyertakan artefak server pada Firebase.
4. Menguji build, bundle browser tanpa secret, deep link, refresh, login, role, QR tracking nyata, verifikasi koli + ringkasan AI, ekspor, upload, serta audit log.
5. Baru kemudian deploy Firebase Hosting standar.