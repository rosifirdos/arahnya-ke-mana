/**
 * payloadFormatter.ts
 * Utilitas untuk mem-parsing teks notifikasi Google Maps menjadi format pendek untuk ESP32.
 * Format Output: "ARAH|JARAK" (Contoh: "KIRI|200m")
 * 
 * Prioritas deteksi arah:
 * 1. Dari pemetaan ikon (iconDirection) — hasil kalibrasi fingerprint ikon
 * 2. Dari kata kunci di teks notifikasi — fallback jika ikon tidak dikenal
 */

export const formatPayload = (
  title: string,
  text: string,
  subText: string,
  titleBig: string,
  iconDirection?: string | null
): string | null => {
  // Gabungkan semua teks untuk pencarian kata kunci
  const instructionContent = `${title} ${text} ${titleBig}`.toLowerCase();

  if (!instructionContent.trim()) return null;

  let direction = '';

  // PRIORITAS 1: Gunakan arah dari pemetaan ikon (hasil kalibrasi)
  if (iconDirection) {
    direction = iconDirection;
  } else {
    // PRIORITAS 2: Deteksi dari teks notifikasi (fallback)
    if (instructionContent.includes('putar') || instructionContent.includes('balik') || instructionContent.includes('u-turn')) {
      direction = 'BALIK';
    } else if (instructionContent.includes('kiri') || instructionContent.includes('left')) {
      direction = 'KIRI';
    } else if (instructionContent.includes('kanan') || instructionContent.includes('right')) {
      direction = 'KANAN';
    } else if (instructionContent.includes('terus') || instructionContent.includes('lurus') || instructionContent.includes('straight')) {
      direction = 'LURUS';
    } else if (instructionContent.includes('belok') || instructionContent.includes('arah')) {
      // Jika ada kata belok/arah tapi tidak spesifik
      direction = 'LURUS';
    } else {
      // Default jika tidak ada instruksi arah yang jelas
      direction = 'LURUS';
    }
  }

  // Ekstrak jarak dari instruksi
  // Tambahkan dukungan untuk koma (misal 2,2 km)
  const distanceMatch = instructionContent.match(/(\d+[.,]?\d*)\s*\b(km|m|ft|mi|meter|kilometer)\b/i);
  let distance = '-';

  if (distanceMatch) {
    distance = `${distanceMatch[1]}${distanceMatch[2]}`;
  } else {
    // Jika Google Maps tidak menyebutkan jarak (misal karena sudah di titik belok "Belok Kiri Sekarang")
    distance = '0m';
  }

  // Jika jarak 0m dan tidak ada kata-kata khusus, anggap tidak valid agar tidak overwrite layar secara acak
  if (direction === 'LURUS' && distance === '0m' && !instructionContent.match(/\d/)) {
    return null;
  }

  return `${direction}|${distance}`;
};
