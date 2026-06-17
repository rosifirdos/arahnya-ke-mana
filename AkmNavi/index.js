import { AppRegistry } from 'react-native';

// Daftarkan headless task untuk notifikasi SEBELUM import lainnya
// agar tidak crash saat service berjalan di background
try {
  const { RNAndroidNotificationListenerHeadlessJsName } = require('react-native-android-notification-listener');

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

        const fullContent = `${title} | ${text} | ${subText} | ${titleBig}`;

        // Simpan log terakhir ke AsyncStorage agar bisa dilihat di layar UI
        try {
          const AsyncStorageModule = require('@react-native-async-storage/async-storage');
          const AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;

          // Debug: simpan notifikasi lengkap (termasuk iconLarge)
          await AsyncStorage.setItem('@last_notif_debug', JSON.stringify(notifObj));

          // Deteksi apakah sudah sampai di tujuan
          const allText = `${title} ${text} ${subText} ${titleBig}`.toLowerCase();
          const arrivalKeywords = ['tiba', 'arrived', 'destination', 'sampai', 'telah tiba', 'you have arrived', 'anda telah', 'mencapai tujuan'];
          const isArrived = arrivalKeywords.some(kw => allText.includes(kw));

          // Gunakan native module untuk menganalisis ikon navigasi
          // IconAnalyzer mendekode gambar PNG dan menentukan arah dari distribusi piksel
          let iconDirection = 'LURUS'; // Default
          try {
            const { NativeModules } = require('react-native');
            const { IconAnalyzer } = NativeModules;
            if (IconAnalyzer && iconLarge && iconLarge.length > 100) {
              iconDirection = await IconAnalyzer.analyzeDirection(iconLarge);
              console.log(`IconAnalyzer detected: ${iconDirection}`);
            }
          } catch (analyzerError) {
            console.warn('IconAnalyzer error, using text fallback:', analyzerError);
            // Fallback: deteksi dari teks jika native module gagal
            const fullText = `${title} ${text} ${titleBig}`.toLowerCase();
            if (fullText.includes('putar') || fullText.includes('balik') || fullText.includes('u-turn')) {
              iconDirection = 'BALIK';
            } else if (fullText.includes('kiri') || fullText.includes('left')) {
              iconDirection = 'KIRI';
            } else if (fullText.includes('kanan') || fullText.includes('right')) {
              iconDirection = 'KANAN';
            }
          }

          // Simpan versi ringkas dengan hasil analisis ikon
          const leanNotif = { title, text, subText, titleBig, app, iconDirection, isArrived };
          await AsyncStorage.setItem('@last_notif', JSON.stringify(leanNotif));
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
