# Product Requirement Document (PRD)
## Proyek IoT: Arahnya ke Mana (Heads-Up Display)

### 1. Ringkasan Proyek (Project Overview)
Proyek ini bertujuan untuk membangun sebuah sistem *Heads-Up Display* (HUD) sekunder berbasis IoT untuk navigasi kendaraan. Sistem ini terdiri dari dua komponen utama: aplikasi Android kustom ("Arahnya ke Mana Navi") yang bertugas menyadap instruksi rute dari notifikasi Google Maps, dan perangkat keras berbasis mikrokontroler ESP32 yang menerima instruksi tersebut via Bluetooth Low Energy (BLE) untuk ditampilkan secara *real-time* pada layar LCD 1602.

### 2. Tujuan & Sasaran (Objectives)
* **Keamanan Berkendara:** Menyediakan indikator arah yang ringkas pada panel *dashboard* motor atau mobil sehingga pengguna tidak perlu sering melihat layar ponsel.
* **Integrasi Sistem Menyeluruh:** Mengembangkan arsitektur *end-to-end* yang menggabungkan rekayasa perangkat keras (mikrokontroler) dengan pengembangan aplikasi perangkat bergerak (*mobile app development*).
* **Efisiensi Komponen:** Memaksimalkan GPS bawaan ponsel cerdas tanpa perlu menambahkan modul satelit eksternal pada sirkuit perangkat keras.

### 3. Spesifikasi Perangkat Keras (Hardware Specifications)
Daftar komponen fisik yang akan dirangkai menjadi unit *receiver* visual:

| Komponen | Spesifikasi / Deskripsi | Fungsi Utama |
| :--- | :--- | :--- |
| **ESP32 DevKit V1** | Mikrokontroler 32-bit dengan modul Bluetooth (BLE) terintegrasi. | Pusat pengendali (BLE Server), penerima teks, dan pemroses logika tampilan. |
| **LCD 1602 + Modul I2C** | Layar karakter 16x2 dengan chip PCF8574. | Layar antarmuka utama pengguna. Mendukung *Custom Character* (CGRAM) untuk ikon panah. |
| **Breadboard 400 Titik** | Papan sirkuit tanpa solder. | Basis sirkuit purwarupa. |
| **Kabel Jumper** | *Female-to-Male* (4 buah). | Menghubungkan jalur daya (5V, GND) dan data (SDA, SCL) dari I2C ke ESP32. |

### 4. Tumpukan Teknologi & Perangkat Lunak (Tech Stack)
Pengembangan perangkat lunak dibagi menjadi dua lingkungan (*environment*) yang berbeda:

**A. Aplikasi Pendamping Android (Mobile App)**
* **Desain UI/UX:** Figma (Pembuatan *wireframe*, tata letak, dan aset ikon).
* **Framework:** React Native.
* **Bahasa Pemrograman:** TypeScript (untuk keamanan tipe data dan skalabilitas kode).
* **Styling:** NativeWind (ekstensi Tailwind CSS untuk React Native).
* **Library Utama:** * `react-native-ble-plx` (Manajemen koneksi Bluetooth ke ESP32).
  * `react-native-android-notification-listener` (Menyadap teks notifikasi dari Google Maps).

**B. Perangkat Keras (Firmware ESP32)**
* **Platform:** Arduino IDE (C++).
* **Library Utama:**
  * `<BLEDevice.h>`, `<BLEServer.h>`, `<BLEUtils.h>` (Pustaka bawaan manajemen BLE).
  * `<LiquidCrystal_I2C.h>` (Pengendali layar LCD).

### 5. Kebutuhan Fungsional (Functional Requirements)

**A. Sisi Aplikasi Android**
1. **Manajemen Izin (Permissions):** Aplikasi wajib meminta dan memvalidasi akses `ACCESS_FINE_LOCATION`, `BLUETOOTH_CONNECT`, dan `BIND_NOTIFICATION_LISTENER_SERVICE` saat pertama kali dijalankan.
2. **Pemindai Perangkat (BLE Scanner):** Aplikasi memiliki antarmuka untuk memindai, memilih, dan menghubungkan ponsel dengan perangkat ESP32 secara manual.
3. **Ekstraksi Data:** Aplikasi membaca *pop-up* notifikasi aktif dari paket `com.google.android.apps.maps`, kemudian mengekstrak dua lapis data: **Tindakan** (Belok kiri, Putar balik) dan **Jarak** (Dalam 200 meter).
4. **Pemformatan Data (Payload):** Aplikasi meringkas instruksi panjang menjadi string pendek sebelum dikirim via BLE untuk mencegah *buffer overflow* di ESP32 (Contoh: `"KIRI|200m"`).
5. **Background Service:** Aplikasi harus bisa terus menyadap notifikasi dan mengirim data BLE meskipun layar ponsel dalam keadaan mati atau Google Maps berjalan di atasnya.

**B. Sisi Perangkat Keras (ESP32)**
1. **Inisialisasi BLE:** ESP32 menyiarkan (*advertising*) sinyal BLE dengan nama *Service* "AKM_Navi".
2. **Konektivitas Visual:** * Saat terputus: Layar LCD menampilkan `"Menunggu Koneksi..."`.
   * Saat terhubung: Layar LCD menampilkan `"Terhubung ke HP"` selama 2 detik sebelum masuk ke mode siaga navigasi.
3. **Penerjemah Ikon (Custom Character):** ESP32 menyimpan peta bit (*bitmap*) karakter khusus di CGRAM untuk menggambar ikon "Panah Kiri", "Panah Kanan", dan "Lurus".
4. **Parser Instruksi:** Saat menerima string `"KIRI|200m"`, ESP32 memisahkan data menggunakan pembatas (*delimiter*) `|` dan merendernya ke LCD:
   * **Baris 1:** `[IKON_PANAH_KIRI] Belok Kiri`
   * **Baris 2:** `Jarak: 200m`

### 6. Kebutuhan Non-Fungsional (Non-Functional Requirements)
* **Latensi Rendah:** Jeda waktu antara munculnya notifikasi di ponsel hingga teks berubah di layar LCD maksimal adalah **1 detik**.
* **Keandalan Koneksi:** Jika pengguna menjauh dari ESP32 (koneksi BLE terputus), ESP32 harus secara otomatis kembali ke mode penyiaran (*advertising mode*) tanpa perlu ditekan tombol *Reset*, dan aplikasi Android mencoba menyambung ulang (*auto-reconnect*).
* **Efisiensi Baterai Android:** Proses *scanning* BLE harus dihentikan segera setelah perangkat terhubung untuk menghemat konsumsi daya ponsel.

### 7. Alur Sistem (System Data Flow)
1. Pengguna memulai navigasi rute di aplikasi Google Maps.
2. Google Maps memunculkan notifikasi rute latar belakang di Android.
3. Aplikasi React Native membaca isi teks dari notifikasi tersebut.
4. Teks diringkas, lalu ditransmisikan melalui koneksi BLE.
5. ESP32 menerima pesan (paket data).
6. ESP32 memperbarui karakter grafis pada modul I2C.
7. LCD 1602 menampilkan arah visual fisik kepada pengendara.