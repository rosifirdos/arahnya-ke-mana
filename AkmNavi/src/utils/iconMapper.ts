/**
 * iconMapper.ts
 * Utilitas untuk mendeteksi arah navigasi berdasarkan fingerprint ikon notifikasi Google Maps.
 * 
 * Cara kerja:
 * - Setiap ikon panah dari Google Maps (kiri, kanan, lurus, putar balik) memiliki
 *   data gambar (base64) yang unik dan konsisten.
 * - Kita menghitung hash dari data gambar tersebut sebagai "fingerprint".
 * - User mengkalibrasi dengan mencocokkan fingerprint ke arah (KIRI/KANAN/LURUS/BALIK).
 * - Setelah dikalibrasi, deteksi arah otomatis berdasarkan fingerprint.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ICON_MAP_KEY = '@icon_direction_map';

/**
 * Menghitung hash sederhana (djb2) dari string base64 ikon.
 * Hash ini menjadi fingerprint unik untuk setiap jenis ikon panah.
 */
export function computeIconHash(iconBase64: string): string {
  if (!iconBase64 || iconBase64.length < 100) return '';

  // Hapus prefix data URI (misal "data:image/png;base64,")
  const base64Data = iconBase64.replace(/^data:image\/[^;]+;base64,/, '');

  // djb2 hash algorithm
  let hash = 5381;
  for (let i = 0; i < base64Data.length; i++) {
    hash = ((hash << 5) + hash) + base64Data.charCodeAt(i);
    hash = hash & 0xFFFFFFFF; // Tetap 32-bit integer
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Muat semua pemetaan ikon (hash → arah) dari AsyncStorage.
 */
export async function loadIconMappings(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(ICON_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Simpan pemetaan ikon: hash → arah (KIRI/KANAN/LURUS/BALIK).
 */
export async function saveIconMapping(hash: string, direction: string): Promise<void> {
  const mappings = await loadIconMappings();
  mappings[hash] = direction;
  await AsyncStorage.setItem(ICON_MAP_KEY, JSON.stringify(mappings));
}

/**
 * Cari arah untuk hash ikon tertentu.
 * Mengembalikan null jika hash belum dipetakan.
 */
export async function getDirectionFromIcon(hash: string): Promise<string | null> {
  const mappings = await loadIconMappings();
  return mappings[hash] || null;
}

/**
 * Hitung berapa banyak ikon yang sudah dipetakan.
 */
export async function getMappingCount(): Promise<number> {
  const mappings = await loadIconMappings();
  return Object.keys(mappings).length;
}

/**
 * Hapus semua pemetaan ikon (untuk reset kalibrasi).
 */
export async function clearMappings(): Promise<void> {
  await AsyncStorage.removeItem(ICON_MAP_KEY);
}
