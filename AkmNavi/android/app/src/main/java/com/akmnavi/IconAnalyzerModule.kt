package com.akmnavi

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.util.Base64
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

/**
 * Native module untuk menganalisis ikon navigasi Google Maps.
 * Mendekode base64 PNG menjadi Bitmap, lalu menganalisis distribusi piksel
 * untuk menentukan arah panah (KIRI, KANAN, LURUS, BALIK) tanpa kalibrasi.
 *
 * Cara kerja:
 * 1. Decode base64 → Bitmap
 * 2. Hitung jumlah piksel "berwarna" (non-background) di setiap kuadran
 * 3. Bandingkan distribusi kiri vs kanan, atas vs bawah
 * 4. Tentukan arah berdasarkan pola distribusi
 */
class IconAnalyzerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "IconAnalyzer"

    @ReactMethod
    fun analyzeDirection(base64Icon: String, promise: Promise) {
        try {
            if (base64Icon.isEmpty() || base64Icon.length < 100) {
                promise.resolve("LURUS") // Default jika ikon kosong
                return
            }

            // Hapus prefix data:image/... jika ada
            val cleanBase64 = base64Icon
                .replace(Regex("^data:image/[^;]+;base64,"), "")
                .trim()

            // Decode base64 ke byte array
            val imageBytes = Base64.decode(cleanBase64, Base64.DEFAULT)

            // Decode ke Bitmap
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            if (bitmap == null) {
                promise.resolve("LURUS") // Default jika gagal decode
                return
            }

            val direction = analyzePixelDistribution(bitmap)
            bitmap.recycle()

            promise.resolve(direction)
        } catch (e: Exception) {
            // Jangan crash, kembalikan default
            promise.resolve("LURUS")
        }
    }

    /**
     * Menganalisis distribusi piksel berwarna pada gambar ikon navigasi.
     *
     * Strategi:
     * - Bagi gambar menjadi zona: kiri, kanan, atas, bawah, tengah
     * - Hitung piksel "aktif" (berwarna, bukan background putih/transparan)
     * - Bandingkan rasio untuk menentukan arah:
     *   - Lebih banyak di kiri → panah ke KIRI
     *   - Lebih banyak di kanan → panah ke KANAN
     *   - Lebih banyak di atas → panah LURUS (ke atas)
     *   - Pola melengkung ke bawah → BALIK (U-turn)
     */
    private fun analyzePixelDistribution(bitmap: Bitmap): String {
        val width = bitmap.width
        val height = bitmap.height

        if (width < 4 || height < 4) return "LURUS"

        var minX = width
        var maxX = 0
        var minY = height
        var maxY = 0
        var sumX = 0L
        var sumY = 0L
        var totalActive = 0

        val bgColor = detectBackgroundColor(bitmap)
        val bgAlpha = Color.alpha(bgColor)
        val isBgTransparent = bgAlpha < 50

        for (y in 0 until height) {
            for (x in 0 until width) {
                val pixel = bitmap.getPixel(x, y)

                if (!isBackgroundPixel(pixel, bgColor, isBgTransparent)) {
                    if (x < minX) minX = x
                    if (x > maxX) maxX = x
                    if (y < minY) minY = y
                    if (y > maxY) maxY = y

                    sumX += x
                    sumY += y
                    totalActive++
                }
            }
        }

        if (totalActive < 10) return "LURUS" // Terlalu sedikit piksel

        val bbWidth = maxX - minX + 1
        val bbHeight = maxY - minY + 1
        val bbCenterX = minX + (bbWidth / 2.0f)
        val bbCenterY = minY + (bbHeight / 2.0f)

        val comX = sumX.toFloat() / totalActive
        val comY = sumY.toFloat() / totalActive

        // Perbedaan Center of Mass (CoM) terhadap titik tengah Bounding Box
        // Nilai negatif berarti CoM lebih ke KIRI atau ATAS.
        val diffX = (comX - bbCenterX) / bbWidth
        val diffY = (comY - bbCenterY) / bbHeight

        // Analisis berdasarkan pergeseran titik berat (Center of Mass)
        // Panah biasanya memiliki "kepala" yang lebih lebar sehingga titik beratnya bergeser ke arah panah.

        // Jika pergeseran horizontal lebih dominan daripada vertikal
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < -0.03f) return "KIRI"
            if (diffX > 0.03f) return "KANAN"
        } else {
            // Jika pergeseran vertikal lebih dominan
            if (diffY < -0.03f) return "LURUS"
            if (diffY > 0.03f) return "BALIK"
        }

        // Fallback jika pergeseran tidak kuat: bagi dua Bounding Box
        var leftCount = 0
        var rightCount = 0
        for (y in minY..maxY) {
            for (x in minX..maxX) {
                val pixel = bitmap.getPixel(x, y)
                if (!isBackgroundPixel(pixel, bgColor, isBgTransparent)) {
                    if (x < bbCenterX) leftCount++ else rightCount++
                }
            }
        }
        val leftRatio = leftCount.toFloat() / totalActive
        if (leftRatio > 0.55f) return "KIRI"
        if (leftRatio < 0.45f) return "KANAN"

        return "LURUS"
    }

    /**
     * Mendeteksi warna background dari sudut-sudut gambar.
     * Mengambil piksel di 4 sudut dan menggunakan warna yang paling sering muncul.
     */
    private fun detectBackgroundColor(bitmap: Bitmap): Int {
        val corners = listOf(
            bitmap.getPixel(0, 0),
            bitmap.getPixel(bitmap.width - 1, 0),
            bitmap.getPixel(0, bitmap.height - 1),
            bitmap.getPixel(bitmap.width - 1, bitmap.height - 1)
        )

        // Ambil warna yang paling sering muncul di sudut
        return corners.groupingBy { it }.eachCount().maxByOrNull { it.value }?.key ?: Color.WHITE
    }

    /**
     * Menentukan apakah suatu piksel adalah background.
     */
    private fun isBackgroundPixel(pixel: Int, bgColor: Int, isBgTransparent: Boolean): Boolean {
        val alpha = Color.alpha(pixel)

        // Jika piksel ini transparan, pasti background
        if (alpha < 50) return true

        // Jika background keseluruhan adalah transparan, maka piksel solid BUKAN background
        // (Ini mencegah panah warna putih dianggap sebagai background)
        if (isBgTransparent) return false

        // Jika background solid, bandingkan warna piksel dengan warna background
        val dr = Math.abs(Color.red(pixel) - Color.red(bgColor))
        val dg = Math.abs(Color.green(pixel) - Color.green(bgColor))
        val db = Math.abs(Color.blue(pixel) - Color.blue(bgColor))
        
        if (dr < 30 && dg < 30 && db < 30) return true

        return false
    }
}
