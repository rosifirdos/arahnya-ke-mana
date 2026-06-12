/**
 * payloadFormatter.ts
 * Utilitas untuk mem-parsing teks notifikasi Google Maps menjadi format pendek untuk ESP32.
 * Format Output: "ARAH|JARAK" (Contoh: "KIRI|200m")
 */

export const formatPayload = (title: string, text: string, subText: string, titleBig: string): string | null => {
  const content = `${title} ${text} ${subText} ${titleBig}`.toLowerCase();
  
  if (!content.trim()) return null;

  let direction = '';
  
  // Deteksi arah
  if (content.includes('putar balik') || content.includes('u-turn')) {
    direction = 'BALIK';
  } else if (content.includes('kiri') || content.includes('left')) {
    direction = 'KIRI';
  } else if (content.includes('kanan') || content.includes('right')) {
    direction = 'KANAN';
  } else if (content.includes('terus') || content.includes('lurus') || content.includes('straight')) {
    direction = 'LURUS';
  } else if (content.includes('belok')) {
    // Jika ada kata belok tapi tidak jelas kiri/kanan
    direction = 'BELOK';
  } else {
    // Jika tidak ada kata arah, kita biarkan kosong agar ESP32 hanya menampilkan jarak
    direction = ' ';
  }

  // Ekstrak jarak
  const distanceMatch = content.match(/(\d+[.,]?\d*)\s*(km|m|ft|mi)/);
  let distance = '-';
  
  if (distanceMatch) {
    distance = `${distanceMatch[1]}${distanceMatch[2]}`;
  }

  // Jika tidak ada jarak dan arah tidak jelas, jangan kirim update kosong
  if (direction === ' ' && distance === '-') {
    return null;
  }

  return `${direction}|${distance}`;
};
