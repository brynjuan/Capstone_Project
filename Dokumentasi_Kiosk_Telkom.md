# Dokumentasi Sistem Kiosk Pelayanan Pintar (Telkom)

## 1. Deskripsi Umum Proyek
Proyek ini adalah sistem **Kiosk Pelayanan Mandiri (Self-Service Kiosk)** berbasis layar sentuh (*touchscreen*) yang diperuntukkan bagi ruang tunggu Plasa Telkom. 
Sistem ini bertujuan mendigitalisasi buku tamu tradisional menjadi **Smart Queue System** (Sistem Antrean Cerdas). Ketika pengunjung datang, Kiosk tidak hanya mendata identitas, tetapi juga mampu membaca KTP secara otomatis (AI), mengambil foto pengunjung, dan secara *real-time* memberikan notifikasi langsung kepada tim Customer Service (CS) melalui Telegram.

### 1.1 Konsep Multi-Regional (Satu Web, Banyak Lokasi)
Keunggulan utama dari arsitektur proyek ini adalah kemampuannya berjalan sebagai **Multi-Tenant / Multi-Regional Application**. 
Meskipun hanya ada **1 buah website (1 codebase & 1 database)**, sistem ini secara cerdas mampu melayani beberapa lokasi fisik Kiosk yang berbeda secara bersamaan (misalnya: Plasa Telkom Palu dan Plasa Telkom Gorontalo).
- **Isolasi Kiosk & Admin:** Kiosk fisik di Palu akan *login* menggunakan akun Kiosk-Palu, dan Admin CS di Palu akan *login* menggunakan akun Admin-Palu.
- **Isolasi Antrean:** Pengunjung yang mendaftar di Kiosk Palu hanya akan masuk ke dalam antrean Palu. Nomor antrean dan data pengunjung tidak akan bocor/tercampur dengan layar Kiosk di Gorontalo.
- **Isolasi Notifikasi:** Pesan notifikasi Telegram akan didistribusikan ke grup CS yang berbeda sesuai dengan lokasi (Region) tamu tersebut mendaftar.

---

## 2. Arsitektur & Teknologi Utama
Aplikasi ini dikembangkan dengan arsitektur web modern yang memastikan performa, keamanan, dan fungsionalitas tingkat tinggi.

### A. Core Framework & Bahasa
- **Next.js (App Router):** Framework React.js modern yang menangani *Server-Side Rendering* (SSR) dan *Server Actions*.
- **TypeScript:** Digunakan untuk memberikan struktur kode yang kuat (type-safe).

### B. Database & Backend
- **PostgreSQL:** Database relasional yang kuat untuk menyimpan semua data.
- **Prisma ORM:** Digunakan sebagai jembatan untuk memanipulasi data di PostgreSQL dengan sangat mudah.

### C. Antarmuka (Front-End) & Animasi
- **Tailwind CSS:** Framework CSS yang digunakan untuk mendesain antarmuka Kiosk.
- **Framer Motion:** Pustaka animasi tingkat lanjut untuk memberikan efek transisi yang sangat mulus layaknya aplikasi *Native Mobile*.
- **React Hook Form:** Mengelola *state* formulir pendaftaran pengunjung agar cepat dan ringan.

### D. Layanan Eksternal (Third-Party Cloud Services)
- **Cloudflare R2 (S3 Compatible):** Layanan penyimpanan awan (*Cloud Storage*) super cepat untuk menyimpan foto KTP dan wajah.
- **Telegram Bot API:** Mesin notifikasi yang akan mengirimkan peringatan instan ke grup CS sesuai Region.
- **Google Vision API (AI OCR):** Kecerdasan buatan dari Google untuk memindai foto KTP fisik.
- **Supabase (Real-time Channels):** Menggunakan fitur WebSockets (*Pub/Sub*) untuk komunikasi *Real-time* antara Dashboard CS dan Kiosk.
- **Cloudflare Turnstile:** Sistem pelindung anti-bot modern (pengganti CAPTCHA jadul).
- **ZegoCloud (Intercom):** Teknologi WebRTC terintegrasi yang memungkinkan Kiosk digunakan sebagai sarana *Video/Voice Call* darurat ke CS.
- **Finpay Widget:** Integrasi eksternal untuk melayani pembayaran mandiri layanan Telkom (Indibiz).
- **Google Sheets API:** Mekanisme *backup* otomatis dan *reporting* harian (via Service Account).

---

## 3. Alur Kerja Sistem (User Flow)

### A. Pendaftaran Langsung di Kiosk (*Walk-In*)
1. **Interaksi Awal:** Layar Kiosk menampilkan *video background* interaktif. Sentuhan pertama memunculkan formulir.
2. **Scan KTP / Input Manual:** Pengunjung memindai KTP via Webcam, AI otomatis mengisi form.
3. **Capture Rahasia (Background Camera):** Saat pengunjung fokus mengisi formulir, Kiosk secara diam-diam otomatis mengambil foto wajah pengunjung melalui *webcam* sebagai bukti administrasi/keamanan tanpa mengganggu alur pengisian.
4. **Data Disubmit (Fire-and-Forget):** 
   - Data diri masuk ke Database dengan label `Region` lokasi Kiosk tersebut.
   - Server merespons "SUKSES" secara kilat (kurang dari 1 detik).
   - Di *background*, foto diunggah ke Cloudflare R2 dan Telegram Bot mengirim pesan ke Grup CS (Region spesifik).
5. **Sukses:** Kiosk menampilkan posisi antrean sesuai lokasi.

### B. Prapendaftaran Mobile (Pindai QR)
1. **Daftar Jarak Jauh:** Pengunjung memindai QR code via HP (Mobile).
2. **Form HP:** Pengunjung mengisi form, memilih lokasi tujuan, dan mendapatkan **6 Digit PIN** (Status `PRE_REGISTER`).
3. **Validasi di Kiosk:** Setibanya di Plasa Telkom, pengunjung mengetik 6 digit PIN. 
4. **Check-in Berhasil:** Kiosk akan mencaplok pengunjung tersebut ke dalam antrean Region-nya dan memicu notifikasi Telegram.

### C. Alur Pelayanan Admin/CS
1. **Dashboard Monitoring:** Admin *login*. Sistem membaca kolom `Region` milik Admin dan hanya menampilkan antrean dari daerah tersebut.
2. **Fitur Panggil:** Admin menekan tombol "Panggil". Dashboard mengirim *ping* Real-time ke Supabase.
3. **Web Speech API:** Kiosk di daerah tersebut menerima *ping*, dan menyuarakan Text-to-Speech: *"Panggilan untuk pelanggan..."*.
4. **Penyelesaian:** Admin menekan tombol selesai. Sistem cerdas otomatis memanggil antrean berikutnya.

---

## 4. Mekanisme Optimalisasi (Anti-Lag & Kestabilan)
- **Smart Polling (Anti-Bottleneck):** Pengecekan status *lock/busy* Kiosk ke server menggunakan *recursive setTimeout*. Ini mencegah antrean request bertumpuk (*network jam*) saat koneksi lambat.
- **Debounce Validation:** Validasi pada *Virtual Keyboard* tidak membebani memori CPU di setiap ketikan huruf.
- **Fire and Forget Process:** Proses berat seperti API ke Telegram tidak memblokir antarmuka UI.
- **Memory Management:** Foto dari WebCam dikompresi otomatis (*browser-image-compression*) hingga 90% sebelum diunggah.

---

## 5. Skema Database (Prisma Schema)
Sistem ini menggunakan struktur relasional untuk memisahkan data antrean dan autentikasi. Berikut adalah representasi skema utamanya:

### Tabel `Admin` (`admins`)
Menyimpan akun pengguna, baik untuk petugas Customer Service, Manager, maupun mesin Kiosk itu sendiri.
- `id` (String, PK)
- `email`, `name`, `password` (Credentials - Di-hash menggunakan **Bcryptjs**)
- `role` (Enum): `SUPERADMIN`, `ADMIN`, `KIOSK`
- `region` (String): Mengunci Admin/Kiosk pada satu wilayah tertentu (Contoh: "Palu", "Gorontalo").

### Tabel `VisitorLog` (`visitor_logs`)
Menyimpan seluruh rekam jejak, data, dan status kunjungan pelanggan.
- **Data Diri:** `fullName`, `phoneNumber`, `institution`, `internetNumber`, `address`
- **Detail Kunjungan:** `category`, `purpose`, `hostName`
- **Media:** `photoUrl` (URL dari Cloudflare R2)
- **Multi-Region:** `region` (Mengikat data ke lokasi Kiosk tertentu)
- **Telegram Data:** `tgMsgId`, `tgChatId`, `tgCompletedMsgId`
- **Manajemen Waktu & Status:** `status`, `checkInTime`, `serviceStartTime`, `checkOutTime`
- **Lainnya:** `adminId` (CS yang melayani tamu), `rating` (Penilaian dari tamu).

### Tabel `KioskSetting` (`kiosk_settings`)
Mengontrol status global mesin Kiosk secara jarak jauh (Remote Control).
- `id` (String, PK): Menggunakan nama *Region* (misal: "Palu").
- `isBusy` (Boolean): Jika `true`, layar Kiosk akan terkunci (Lock-down).

---

## 6. Fitur Pendukung Kritis (Detail Tersembunyi)
Selain alur utama di atas, proyek ini menyimpan beberapa logika krusial di sisi *Backend* dan *Frontend* yang sangat penting bagi operasional *Self-Service Kiosk*:

### 6.1 Sinkronisasi Otomatis (Database, Telegram, & Google Sheets)
Terdapat fitur sinkronisasi *real-time* yang memastikan konsistensi data di semua platform. Apabila Admin melakukan perubahan data (Edit) atau pembatalan/penghapusan data (Delete) melalui Dashboard Admin, sistem tidak hanya mengubahnya di *Database*, melainkan secara otomatis menyinkronkannya ke dua saluran lain:
- **Google Sheets (`lib/sheets.ts`):** Setiap aksi kunjungan selesai, data dikirim ke Google Sheets (Sebagai Laporan & Backup). Luar biasanya, jika Admin mengedit data tamu atau menghapus data tamu di Dashboard, *backend* akan secara cerdas mencari baris (*row*) yang bersangkutan di Google Sheets dan ikut mengedit atau menghapusnya secara otomatis.
- **Telegram Bot (Sistem Notifikasi Berjenjang):** Sistem perpesanan Telegram didesain menggunakan hierarki dua lapis, yaitu **Grup CS (Operasional)** untuk notifikasi *real-time* saat tamu datang, dan **Grup Manager/Atasan (Eksekutif)** untuk pelaporan tamu VIP atau rekap durasi waktu saat layanan telah selesai (`TELEGRAM_CHAT_ID_COMPLETED`). Hebatnya lagi, setiap perubahan status tamu tidak akan menumpuk pesan baru (*spamming*) di Grup CS. *Backend* menggunakan fitur API *EditMessageMedia* untuk mengubah isi pesan (*update* status) dari foto yang sama secara *real-time*.

### 6.2 Sistem Auto-Reset (Idle Timeout Hapus Data)
Jika seorang pengunjung mulai mendaftar namun tiba-tiba membatalkan niatnya lalu pergi (meninggalkan layar Kiosk menyala berisi KTP dan Nomor HP mereka), sistem memiliki **Detektor Idle**. Jika tidak ada aktivitas sentuhan selama **60 detik**, Kiosk akan memunculkan hitung mundur peringatan 10 detik sebelum akhirnya menghapus seluruh isian (*Clear Form Data*) dan kembali ke layar beranda untuk melindungi privasi pengunjung sebelumnya.

### 6.3 Intercom ZegoCloud (Komunikasi Darurat)
Terdapat integrasi *Dynamic Import* pustaka `@zegocloud/zego-uikit-prebuilt`. Ini adalah sebuah *widget WebRTC* yang memungkinkan layar Kiosk difungsikan sebagai "Telepon Intercom" darurat (*Voice/Video Call*). Jika tamu kebingungan saat mendaftar, mereka dapat memanggil CS secara langsung melalui mesin Kiosk tanpa harus meninggalkan posisinya.

### 6.4 Integrasi Finpay (Payment Gateway Mandiri)
Kiosk juga difungsikan sebagai alat bantu transaksi mandiri. Pengunjung dapat membuka pop-up **Widget Finpay** (`live.finpay.id/widgetpg`) secara langsung di layar Kiosk untuk membayar tagihan IndiBiz/Telkom tanpa antre ke meja Customer Service.

### 6.5 Keamanan Akses Mesin (Device Authentication)
Meskipun Kiosk berjalan menggunakan antarmuka Web biasa (URL), sistem ini memiliki lapisan *Role-based Middleware*. Jika URL Kiosk dibuka secara sembarangan dari HP/Laptop luar, akses akan ditolak. Sistem akan memaksa *redirect* ke halaman Login sampai perangkat tersebut memiliki izin otorisasi `Role = KIOSK`.

### 6.6 Remote Control & Lockdown Kiosk (Jarak Jauh)
Admin CS dibekali tombol ajaib di dalam Dashboard untuk mengontrol fisik mesin Kiosk di depan. Melalui manipulasi tabel `KioskSetting`, Admin dapat mengirim perintah *Lock-down* (Kunci Layar) beserta pesan kustom (Contoh: *"Mohon maaf, pelayanan sedang istirahat sholat Jumat"*). Layar Kiosk akan langsung terkunci secara seketika (*real-time* via Supabase) dan pengunjung tidak dapat menyentuh layar apa pun hingga Admin membukanya kembali.

### 6.7 Prapendaftaran VIP (Admin-Generated PIN)
Selain pengunjung mendaftar via QR Code, Admin juga memiliki wewenang untuk mencetak 6-Digit PIN secara manual (Generasi PIN VIP). Fitur ini sangat berguna jika ada tamu penting (Manajer, Pejabat) yang akan datang, sehingga Admin dapat mendaftarkannya terlebih dahulu dari belakang meja, lalu mengirimkan PIN tersebut via WhatsApp ke tamu VIP. Saat tamu datang, mereka tidak perlu repot mengisi form lagi.

### 6.8 Multimedia & Aksesibilitas Suara (Web Speech API)
Kiosk dirancang tidak kaku. Layar beranda memutar *Video Loop* Telkom yang elegan untuk menarik perhatian. Menariknya, sistem ini dilengkapi **Voice Greeting & Guidance**. Berbekal *Web Speech API*, mesin Kiosk secara aktif dapat "berbicara" dalam bahasa Indonesia (contoh: *"Selamat datang di prapendaftaran..."*) untuk memandu tamu, serta otomatis menurunkan (*ducking*) volume musik latar setiap kali membunyikan suara panggilan dari CS.

### 6.9 Panel Superadmin (CRUD & Manajemen Multi-Tenant)
Sistem ini memfasilitasi peran tertinggi yaitu **SUPERADMIN**. Superadmin tidak hanya berfungsi untuk melihat dan memantau keseluruhan data pengunjung dari seluruh cabang, tetapi juga bertindak sebagai **Pusat Manajemen Akun (Account Management)**. Melalui Panel Superadmin, pengguna dapat melakukan **CRUD (Create, Read, Update, Delete)** terhadap akun-akun bawahan:
1. `SUPERADMIN` (Kendali Penuh, bisa melihat data semua region).
2. `ADMIN` (Hanya bisa melihat dan memanggil antrean di Region spesifiknya, contoh: Admin Palu).
3. `KIOSK` (Akun khusus yang ditanamkan ke PC Kiosk agar PC tersebut terkunci hanya untuk menampilkan UI Region miliknya).

### 6.10 Analitik & Metrik Performa Otomatis (Admin Dashboard)
Berbeda dengan buku tamu konvensional, halaman *Dashboard Admin* bukan sekadar menampilkan tabel antrean, melainkan berfungsi penuh sebagai pusat analitik (*Command Center*). Di belakang layar, sistem secara otomatis menghitung dan memvisualisasikan:
- **Analisis Jam Sibuk (Peak Hours):** Sistem merekam tren pada jam berapa saja pengunjung paling padat.
- **Rata-Rata Waktu (SLA):** Terdapat algoritma yang menghitung *Average Wait Time* (Rata-rata tamu menunggu panggilan) dan *Average Service Time* (Rata-rata waktu CS melayani tamu di meja) dalam hitungan detik.
- **Visualisasi Keluhan:** Grafik distribusi kategori masalah (Gangguan, Pasang Baru, Invoicing).
- **Sapu Bersih Anti-Spam:** Admin dibekali fitur "Sapu Bersih PIN" (Menghanguskan semua antrean *Pre-Register* tamu fiktif/batal dalam satu kali klik).

### 6.11 UI/UX Khusus Layar Sentuh (QR Code & Virtual Keyboard)
Mengingat aplikasi Kiosk dioperasikan melalui *Touchscreen* fisik, antarmuka (*frontend*) dibekali dengan **Virtual Keyboard** bawaan aplikasi (menggunakan *react-simple-keyboard*). Hal ini mencegah sistem memunculkan *keyboard* bawaan OS (seperti Windows On-Screen Keyboard) yang seringkali menutupi layar dan terlihat tidak profesional. Selain itu, mesin Kiosk secara dinamis membuatkan gambar **QR Code Prapendaftaran** di pojok layar, memungkinkan pengunjung memindainya dan mengisi formulir dari HP mereka sendiri tanpa harus menyentuh layar Kiosk sama sekali.

### 6.12 Interaktif Photobooth & Souvenir QR Code
Ini adalah salah satu fitur inovatif (*gamification*) untuk meningkatkan kepuasan pengunjung (*Customer Experience*). Setelah pengunjung selesai mendaftar, layar Kiosk akan menawarkan fitur **"Foto Kenangan" (Photobooth)**.
Jika dipilih, Kiosk akan menyalakan *webcam*, menumpuk gambar pengunjung dengan bingkai/ *frame* desain elegan khas Telkom. Setelah difoto, sistem akan otomatis mengunggah gambar tersebut ke *Cloud Server* (R2) dan **menampilkan QR Code**. Pengunjung dapat memindai QR Code tersebut menggunakan *smartphone* mereka untuk mengunduh foto kenangan dari Plasa Telkom secara instan!

---
*Dokumen ini disusun untuk mempermudah pemahaman arsitektur sistem (High-Level Architecture) kepada developer, stakeholder, atau pihak manajemen.*
