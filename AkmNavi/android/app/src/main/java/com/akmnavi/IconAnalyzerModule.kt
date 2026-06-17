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

        // Definisikan zona analisis
        val midX = width / 2
        val midY = height / 2
        val quarterX = width / 4
        val threeQuarterX = (width * 3) / 4
        val quarterY = height / 4
        val threeQuarterY = (height * 3) / 4

        // Hitung piksel aktif di setiap zona
        var leftCount = 0    // Piksel aktif di sisi kiri (0 - midX)
        var rightCount = 0   // Piksel aktif di sisi kanan (midX - width)
        var topCount = 0     // Piksel aktif di bagian atas (0 - midY)
        var bottomCount = 0  // Piksel aktif di bagian bawah (midY - height)

        // Zona tambahan untuk deteksi yang lebih presisi
        var topLeftCount = 0
        var topRightCount = 0
        var bottomLeftCount = 0
        var bottomRightCount = 0

        // Zona tepi ekstrem (untuk panah yang jelas mengarah ke satu sisi)
        var farLeftCount = 0   // 0 - quarterX
        var farRightCount = 0  // threeQuarterX - width
        var farTopCount = 0    // 0 - quarterY
        var farBottomCount = 0 // threeQuarterY - height

        var totalActive = 0

        // Tentukan warna background (ambil dari sudut-sudut gambar)
        val bgColor = detectBackgroundColor(bitmap)

        for (y in 0 until height) {
            for (x in 0 until width) {
                val pixel = bitmap.getPixel(x, y)

                if (!isBackgroundPixel(pixel, bgColor)) {
                    totalActive++

                    // Zona kiri/kanan
                    if (x < midX) leftCount++ else rightCount++

                    // Zona atas/bawah
                    if (y < midY) topCount++ else bottomCount++

                    // Kuadran
                    if (x < midX && y < midY) topLeftCount++
                    if (x >= midX && y < midY) topRightCount++
                    if (x < midX && y >= midY) bottomLeftCount++
                    if (x >= midX && y >= midY) bottomRightCount++

                    // Zona tepi
                    if (x < quarterX) farLeftCount++
                    if (x >= threeQuarterX) farRightCount++
                    if (y < quarterY) farTopCount++
                    if (y >= threeQuarterY) farBottomCount++
                }
            }
        }

        if (totalActive < 10) return "LURUS" // Gambar hampir kosong

        // === ANALISIS ARAH ===

        // Rasio horizontal (kiri vs kanan)
        val horizontalTotal = (leftCount + rightCount).toFloat()
        val leftRatio = if (horizontalTotal > 0) leftCount / horizontalTotal else 0.5f
        val rightRatio = if (horizontalTotal > 0) rightCount / horizontalTotal else 0.5f

        // Rasio vertikal (atas vs bawah)
        val verticalTotal = (topCount + bottomCount).toFloat()
        val topRatio = if (verticalTotal > 0) topCount / verticalTotal else 0.5f

        // Rasio tepi (untuk deteksi yang lebih yakin)
        val farHorizontalTotal = (farLeftCount + farRightCount).toFloat()
        val farLeftRatio = if (farHorizontalTotal > 0) farLeftCount / farHorizontalTotal else 0.5f

        // Deteksi U-Turn: banyak piksel di atas DAN ada pola melengkung
        // U-turn biasanya punya banyak piksel di satu sisi atas dan berlanjut ke bawah
        val topHeavy = topRatio > 0.6f
        val hasUTurnPattern = (topLeftCount > 0 && bottomLeftCount > 0 && topRightCount > 0 &&
            (bottomRightCount.toFloat() / (bottomLeftCount + 1) < 0.3f ||
             bottomLeftCount.toFloat() / (bottomRightCount + 1) < 0.3f))

        if (topHeavy && hasUTurnPattern) {
            return "BALIK"
        }

        // Threshold untuk menentukan apakah condong ke satu sisi
        val strongThreshold = 0.60f  // 60% vs 40%
        val moderateThreshold = 0.55f // 55% vs 45%

        // Deteksi KIRI/KANAN berdasarkan distribusi horizontal
        if (leftRatio > strongThreshold || (leftRatio > moderateThreshold && farLeftRatio > 0.6f)) {
            return "KIRI"
        }
        if (rightRatio > strongThreshold || (rightRatio > moderateThreshold && (1f - farLeftRatio) > 0.6f)) {
            return "KANAN"
        }

        // Jika distribusi cukup merata horizontal → kemungkinan LURUS atau BALIK
        // Cek apakah lebih banyak piksel di atas (panah ke atas = LURUS)
        if (topRatio > 0.55f) {
            return "LURUS"
        }

        // Default: LURUS
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
     * Piksel dianggap background jika:
     * - Transparan (alpha < 50)
     * - Warnanya mirip dengan warna background yang terdeteksi
     * - Putih (mendekati #FFFFFF)
     */
    private fun isBackgroundPixel(pixel: Int, bgColor: Int): Boolean {
        val alpha = Color.alpha(pixel)

        // Transparan = background
        if (alpha < 50) return true

        // Mirip dengan warna background yang terdeteksi
        val dr = Math.abs(Color.red(pixel) - Color.red(bgColor))
        val dg = Math.abs(Color.green(pixel) - Color.green(bgColor))
        val db = Math.abs(Color.blue(pixel) - Color.blue(bgColor))
        if (dr < 30 && dg < 30 && db < 30) return true

        // Piksel sangat terang (hampir putih) juga dianggap background
        if (Color.red(pixel) > 230 && Color.green(pixel) > 230 && Color.blue(pixel) > 230) return true

        return false
    }
}
