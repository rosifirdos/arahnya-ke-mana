import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, PermissionsAndroid, Platform, Alert, View, Text } from 'react-native';
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
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          // Izin Bluetooth Android 12+
          ...(Platform.Version >= 31 ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ] : []),
        ]);

        const allGranted = Object.values(granted).every(
          (status) => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert('Izin Ditolak', 'Aplikasi membutuhkan izin Bluetooth dan Lokasi untuk terhubung ke ESP32.');
        }

        // Cek izin Notification Listener
        const hasNotifPermission = await NotificationService.checkPermission();
        if (!hasNotifPermission) {
          Alert.alert(
            'Akses Notifikasi Dibutuhkan',
            'Mohon izinkan aplikasi untuk membaca notifikasi Google Maps.',
            [
              { text: 'Nanti', style: 'cancel' },
              { text: 'Buka Pengaturan', onPress: () => NotificationService.requestPermission() },
            ]
          );
        }

        setPermissionsGranted(allGranted);
      }
    } catch (err) {
      console.warn(err);
    }
  };

  if (!permissionsGranted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.text}>Menunggu izin aplikasi...</Text>
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
  }
});

export default App;
