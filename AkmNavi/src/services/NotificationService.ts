import { RNAndroidNotificationListener, RNAndroidNotificationListenerHeadlessJsName } from 'react-native-android-notification-listener';
import { AppRegistry } from 'react-native';
import { formatPayload } from '../utils/payloadFormatter';
import BleService from './BleService';

class NotificationService {
  private lastPayload: string | null = null;
  private isListening: boolean = false;

  /**
   * Periksa apakah aplikasi memiliki izin Notification Access
   */
  async checkPermission(): Promise<boolean> {
    try {
      const status = await RNAndroidNotificationListener.getPermissionStatus();
      return status !== 'denied';
    } catch (error) {
      console.warn('Gagal cek izin notifikasi', error);
      return false;
    }
  }

  /**
   * Buka pengaturan Android untuk mengaktifkan akses notifikasi
   */
  requestPermission(): void {
    RNAndroidNotificationListener.requestPermission();
  }

  /**
   * Mendaftarkan background service untuk menangani notifikasi.
   * Harus dipanggil di index.js aplikasi.
   */
  registerHeadlessTask() {
    if (this.isListening) return;

    AppRegistry.registerHeadlessTask(
      RNAndroidNotificationListenerHeadlessJsName,
      () => async ({ notification }) => {
        try {
          if (!notification) return;

          // Kita hanya peduli pada notifikasi dari Google Maps
          const app = notification.app || notification.packageName;
          if (app !== 'com.google.android.apps.maps') return;

          const title = notification.title || '';
          const text = notification.text || '';

          const payload = formatPayload(title, text);

          // Hindari mengirim payload yang sama berulang kali (spam BLE)
          if (payload && payload !== this.lastPayload) {
            this.lastPayload = payload;
            
            // Kirim ke ESP32 melalui BleService jika tersambung
            await BleService.sendCurrentPayload(payload);
          }
        } catch (error) {
          console.error('Error handling notification:', error);
        }
      }
    );
    this.isListening = true;
  }
}

export default new NotificationService();
