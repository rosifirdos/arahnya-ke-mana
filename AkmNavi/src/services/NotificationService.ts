import RNAndroidNotificationListener from 'react-native-android-notification-listener';

class NotificationService {
  /**
   * Periksa apakah aplikasi memiliki izin Notification Access
   */
  async checkPermission(): Promise<boolean> {
    try {
      const status = await RNAndroidNotificationListener.getPermissionStatus();
      console.log('Notification permission status:', status);
      return status === 'authorized';
    } catch (error) {
      console.warn('Gagal cek izin notifikasi:', error);
      return false;
    }
  }

  /**
   * Buka pengaturan Android untuk mengaktifkan akses notifikasi
   */
  requestPermission(): void {
    try {
      RNAndroidNotificationListener.requestPermission();
    } catch (error) {
      console.warn('Gagal buka pengaturan notifikasi:', error);
    }
  }
}

export default new NotificationService();
