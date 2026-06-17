import { AppRegistry } from 'react-native';

// Daftarkan headless task untuk notifikasi SEBELUM import lainnya
// agar tidak crash saat service berjalan di background
try {
  const { RNAndroidNotificationListenerHeadlessJsName } = require('react-native-android-notification-listener');

  /**
   * Menghitung hash fingerprint dari ikon notifikasi (base64 PNG).
   * Inline function agar tidak butuh import di headless context.
   */
  function computeIconHash(iconBase64) {
    if (!iconBase64 || iconBase64.length < 100) return '';
    const base64Data = iconBase64.replace(/^data:image\/[^;]+;base64,/, '');
    let hash = 5381;
    for (let i = 0; i < base64Data.length; i++) {
      hash = ((hash << 5) + hash) + base64Data.charCodeAt(i);
      hash = hash & 0xFFFFFFFF;
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () => async ({ notification }) => {
      try {
        if (!notification) return;

        // Notifikasi dari library ini berupa JSON string
        let notifObj;
        try {
          notifObj = typeof notification === 'string' ? JSON.parse(notification) : notification;
        } catch (e) {
          console.warn('Gagal parse notifikasi', e);
          return;
        }

        const app = notifObj.app || notifObj.packageName || '';
        if (app !== 'com.google.android.apps.maps') return;

        const title = notifObj.title || '';
        const text = notifObj.text || '';
        const subText = notifObj.subText || '';
        const titleBig = notifObj.titleBig || '';
        const iconLarge = notifObj.iconLarge || '';

        // Hitung fingerprint ikon untuk mendeteksi arah
        const iconHash = computeIconHash(iconLarge);

        const fullContent = `${title} | ${text} | ${subText} | ${titleBig}`;

        // Simpan log terakhir ke AsyncStorage agar bisa dilihat di layar UI
        try {
          const AsyncStorageModule = require('@react-native-async-storage/async-storage');
          const AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;

          // Debug: simpan notifikasi lengkap (termasuk iconLarge)
          await AsyncStorage.setItem('@last_notif_debug', JSON.stringify(notifObj));

          // Simpan versi ringkas DENGAN iconHash (tanpa iconLarge yang besar)
          const leanNotif = { title, text, subText, titleBig, app, iconHash };
          await AsyncStorage.setItem('@last_notif', JSON.stringify(leanNotif));

          // Auto-learn: jika teks mengandung kata arah, simpan pemetaan ikon→arah otomatis
          // Ini berguna jika Google Maps kadang-kadang mengirim teks arah
          const fullText = `${title} ${text} ${titleBig}`.toLowerCase();
          let detectedDirection = null;

          if (fullText.includes('putar') || fullText.includes('balik') || fullText.includes('u-turn')) {
            detectedDirection = 'BALIK';
          } else if (fullText.includes('kiri') || fullText.includes('left')) {
            detectedDirection = 'KIRI';
          } else if (fullText.includes('kanan') || fullText.includes('right')) {
            detectedDirection = 'KANAN';
          }
          // Catatan: LURUS tidak di-auto-save karena itu default,
          // dan bisa salah memetakan ikon yang sebenarnya belum dikenal

          if (detectedDirection && iconHash) {
            try {
              const rawMap = await AsyncStorage.getItem('@icon_direction_map');
              const mappings = rawMap ? JSON.parse(rawMap) : {};
              if (!mappings[iconHash]) {
                // Hanya simpan jika belum ada (jangan overwrite kalibrasi manual)
                mappings[iconHash] = detectedDirection;
                await AsyncStorage.setItem('@icon_direction_map', JSON.stringify(mappings));
                console.log(`Auto-learned icon ${iconHash} = ${detectedDirection}`);
              }
            } catch (e) {
              console.warn('Failed to save icon mapping:', e);
            }
          }
        } catch (e) {
          console.error('Gagal menyimpan AsyncStorage di Headless JS:', e);
        }

        const { ToastAndroid } = require('react-native');
        ToastAndroid.show(`MAPS: ${fullContent}`, ToastAndroid.LONG);

        // Hapus pemanggilan BleService dari Headless JS karena akan ditangani oleh HomeScreen.tsx (UI Thread)
        // Ini mencegah masalah state antara background thread dan foreground thread
      } catch (error) {
        console.error('Error handling notification:', error);
      }
    }
  );
} catch (error) {
  console.warn('Failed to register headless task:', error);
}

import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
