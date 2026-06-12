/**
 * payloadFormatter.ts
 * Utilitas untuk mem-parsing teks notifikasi Google Maps menjadi format pendek untuk ESP32.
 * Format Output: "ARAH|JARAK" (Contoh: "KIRI|200m")
 */

export const formatPayload = (title: string, text: string): string | null => {
  if (!title && !text) return null;

  const content = `${title} ${text}`.toLowerCase();
  
  let direction = '';
  
  // Deteksi arah berdasarkan kata kunci Bahasa Indonesia
  if (content.includes('putar balik')) {
    direction = 'BALIK';
  } else if (content.includes('kiri')) {
    direction = 'KIRI';
  } else if (content.includes('kanan')) {
    direction = 'KANAN';
  } else if (content.includes('terus') || content.includes('lurus')) {
    direction = 'LURUS';
  } else {
    // Jika tidak ada arah yang jelas, jangan kirim payload
    return null;
  }

  // Ekstrak jarak (mencari angka diikuti 'm' atau 'km')
  // Contoh: "200 m", "2,5 km", "1.5km"
  const distanceMatch = content.match(/(\d+[.,]?\d*)\s*(km|m)/);
  let distance = '';
  
  if (distanceMatch) {
    // distanceMatch[1] = angka (misal "200")
    // distanceMatch[2] = satuan (misal "m")
    distance = `${distanceMatch[1]}${distanceMatch[2]}`;
  } else {
    // Jika tidak ada jarak, set default kosong atau '-'
    distance = '-';
  }

  return `${direction}|${distance}`;
};
