import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, PermissionsAndroid, Platform, Alert, View, Text, TouchableOpacity } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import ScanScreen from './src/screens/ScanScreen';
import NotificationService from './src/services/NotificationService';

const App = () => {
  const [currentScreen, setCurrentScreen] = useState<'HOME' | 'SCAN'>('HOME');
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const permsToRequest: any[] = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        // Izin Bluetooth Android 12+
        if (Platform.Version >= 31) {
          permsToRequest.push(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          );
        }

        const granted = await PermissionsAndroid.requestMultiple(permsToRequest);

        const allGranted = Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Izin Ditolak',
            'Beberapa izin ditolak. Fitur Bluetooth mungkin tidak berfungsi optimal. Anda bisa mengaktifkannya di Pengaturan.',
          );
        }

        // Selalu izinkan masuk ke app, meskipun izin ditolak
        setPermissionsGranted(true);

        // Cek izin Notification Listener (terpisah, ini bukan runtime permission)
        try {
          const hasNotifPermission = await NotificationService.checkPermission();
          if (!hasNotifPermission) {
            Alert.alert(
              'Akses Notifikasi Dibutuhkan',
              'Mohon izinkan AkmNavi untuk membaca notifikasi Google Maps agar navigasi bisa ditampilkan di ESP32.',
              [
                { text: 'Nanti', style: 'cancel' },
                { text: 'Buka Pengaturan', onPress: () => NotificationService.requestPermission() },
              ]
            );
          }
        } catch (notifErr) {
          console.warn('Notification permission check failed:', notifErr);
        }
      } else {
        setPermissionsGranted(true);
      }
    } catch (err) {
      console.warn('Permission request error:', err);
      // Tetap izinkan masuk meskipun terjadi error
      setPermissionsGranted(true);
    }
  };

  if (!permissionsGranted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.text}>Menyiapkan AKM Navi...</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => setPermissionsGranted(true)}
          >
            <Text style={styles.retryText}>Masuk Tanpa Izin</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {currentScreen === 'HOME' ? (
        <HomeScreen onOpenScan={() => setCurrentScreen('SCAN')} />
      ) : (
        <ScanScreen onClose={() => setCurrentScreen('HOME')} />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FCFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    color: '#333',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#ddd',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: '#666',
  },
});

export default App;
