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

        const app = notification.app || notification.packageName || '';
        if (app !== 'com.google.android.apps.maps') return;

        const title = notification.title || '';
        const text = notification.text || '';
        const payload = formatPayload(title, text);

        if (payload) {
          // Lazy-load BleService agar tidak crash jika BLE belum siap
          const BleService = require('./src/services/BleService').default;
          await BleService.sendCurrentPayload(payload);
        }
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
