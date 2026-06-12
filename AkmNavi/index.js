import { AppRegistry } from 'react-native';

// Daftarkan headless task untuk notifikasi SEBELUM import lainnya
// agar tidak crash saat service berjalan di background
try {
  const { RNAndroidNotificationListenerHeadlessJsName } = require('react-native-android-notification-listener');
  const { formatPayload } = require('./src/utils/payloadFormatter');

  AppRegistry.registerHeadlessTask(
    RNAndroidNotificationListenerHeadlessJsName,
    () => async ({ notification }: any) => {
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
        
        const fullContent = `${title} | ${text} | ${subText} | ${titleBig}`;
        
        // Simpan log terakhir ke AsyncStorage agar bisa dilihat di layar UI
        try {
          const { AsyncStorage } = require('react-native');
          // react-native-async-storage is what we use, so require it properly
          const AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
          await AsyncStorageModule.setItem('@last_notif', JSON.stringify(notifObj));
        } catch (e) {}

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
