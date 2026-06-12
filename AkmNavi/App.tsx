import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Platform, Alert, View, Text, TouchableOpacity } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import NotificationService from './src/services/NotificationService';

const App = () => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        setPermissionsGranted(true);

        // Cek izin Notification Listener
        try {
          const hasNotifPermission = await NotificationService.checkPermission();
          if (!hasNotifPermission) {
            Alert.alert(
              'Akses Notifikasi Dibutuhkan',
              'Mohon izinkan AkmNavi untuk membaca notifikasi Google Maps agar navigasi bisa dikirim ke ESP32.',
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
      <HomeScreen />
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
