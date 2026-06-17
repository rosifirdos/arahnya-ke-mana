import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import BleService from '../services/BleService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatPayload } from '../utils/payloadFormatter';

const HomeScreen: React.FC = () => {
  const [isConnected, setIsConnected] = useState(BleService.isDeviceConnected());
  const [statusMessage, setStatusMessage] = useState('Siap memindai...');
  const [debugLog, setDebugLog] = useState('');
  const [payloadLog, setPayloadLog] = useState('Menunggu data...');
  const [hasArrived, setHasArrived] = useState(false);
  const [currentDirection, setCurrentDirection] = useState('');

  useEffect(() => {
    let lastProcessedLog = '';

    BleService.onConnectionStatusChange = (status) => {
      setIsConnected(status);
      if (status) {
        setStatusMessage('Terhubung ke ESP32');
        lastProcessedLog = ''; // Reset agar notifikasi terakhir langsung dikirim ulang saat reconnect
      } else {
        setStatusMessage('Koneksi terputus');
      }
    };

    const interval = setInterval(async () => {
      try {
        const log = await AsyncStorage.getItem('@last_notif');
        if (!log) return;

        setDebugLog(log);

        // Hanya kirim jika ada notifikasi baru
        if (log !== lastProcessedLog && BleService.isDeviceConnected()) {
          lastProcessedLog = log;

          const notifObj = JSON.parse(log);
          const title = notifObj.title || '';
          const text = notifObj.text || '';
          const subText = notifObj.subText || '';
          const titleBig = notifObj.titleBig || '';
          const iconDirection = notifObj.iconDirection || null;
          const isArrived = notifObj.isArrived || false;

          setHasArrived(isArrived);
          setCurrentDirection(iconDirection || 'LURUS');

          // iconDirection sudah ditentukan oleh native module di headless task
          const payload = formatPayload(title, text, subText, titleBig, iconDirection, isArrived);

          if (payload) {
            BleService.sendCurrentPayload(payload).then(res => {
              setPayloadLog(res);
            });
          } else {
            setPayloadLog('NOT SENT: payload formatter returned null');
          }
        }
      } catch (e: any) {
        console.warn('Error in polling interval:', e);
        setPayloadLog(`ERROR: ${e?.message}`);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      BleService.disconnect();
    };
  }, []);

  const handleScanAndConnect = useCallback(() => {
    if (isConnected) {
      BleService.disconnect();
    } else {
      BleService.scanAndConnect((msg) => {
        setStatusMessage(msg);
      });
    }
  }, [isConnected]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AKM Navi (BLE Mode)</Text>

      <View style={styles.statusContainer}>
        <View style={[styles.indicator, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
        <Text style={styles.statusText}>
          {isConnected ? 'Terhubung' : 'Tidak Terhubung'}
        </Text>
      </View>

      <View style={styles.ipContainer}>
        <Text style={styles.ipLabel}>Status BLE:</Text>
        <Text style={styles.ipValue}>{statusMessage}</Text>
      </View>

      {!isConnected && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Cara Menghubungkan:</Text>
          <Text style={styles.warningDesc}>
            1. Nyalakan Bluetooth di HP Anda.{'\n'}
            2. Nyalakan perangkat ESP32 HUD.{'\n'}
            3. Pastikan LCD menampilkan "Menunggu Koneksi BLE...".{'\n'}
            4. Tekan tombol "Scan & Connect" di bawah ini.{'\n'}
            5. Aplikasi akan otomatis mencari "AKM_Navi" dan menyambungkannya.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, isConnected ? styles.buttonDisconnect : null]}
        onPress={handleScanAndConnect}
      >
        <Text style={styles.buttonText}>{isConnected ? 'Putus Koneksi' : 'Scan & Connect'}</Text>
      </TouchableOpacity>

      {/* === PEMBERITAHUAN SAMPAI DI TUJUAN === */}
      {hasArrived && (
        <View style={styles.arrivedBox}>
          <Text style={styles.arrivedIcon}>🏁</Text>
          <Text style={styles.arrivedTitle}>Anda Telah Sampai!</Text>
          <Text style={styles.arrivedDesc}>Anda telah tiba di lokasi tujuan. Selamat!</Text>
        </View>
      )}

      {/* === STATUS NAVIGASI AKTIF === */}
      {isConnected && currentDirection && !hasArrived && (
        <View style={styles.navStatusBox}>
          <Text style={styles.navStatusTitle}>🧭 Navigasi Aktif</Text>
          <Text style={styles.navStatusDirection}>
            Arah Terdeteksi: <Text style={styles.navStatusValue}>{currentDirection}</Text>
          </Text>
          <Text style={styles.navStatusInfo}>
            Arah dianalisis otomatis dari ikon Google Maps
          </Text>
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Cara Menggunakan:</Text>
        <Text style={styles.infoDesc}>
          1. Hubungkan ke ESP32 dengan tombol "Scan & Connect".{'\n'}
          2. Buka Google Maps dan mulai navigasi ke tujuan Anda.{'\n'}
          3. Arah navigasi akan otomatis terdeteksi dan ditampilkan di LCD ESP32.{'\n'}
          4. Tidak perlu kalibrasi — semua berjalan otomatis!
        </Text>
      </View>

      <View style={styles.debugBox}>
        <Text style={styles.debugTitle}>BLE TX Status:</Text>
        <Text style={styles.debugDesc}>{payloadLog}</Text>
        <Text style={styles.debugTitle}>Detected Direction:</Text>
        <Text style={styles.debugDesc}>{currentDirection || '-'}</Text>
        <Text style={styles.debugTitle}>Debug Log (Last Notification):</Text>
        <Text style={styles.debugDesc}>{debugLog}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 20,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    width: '100%',
    justifyContent: 'center',
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  ipContainer: {
    width: '100%',
    padding: 15,
    backgroundColor: '#E8EAF6',
    borderRadius: 8,
    marginBottom: 20,
  },
  ipLabel: {
    fontSize: 14,
    color: '#3F51B5',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ipValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  warningBox: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningTitle: {
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 5,
  },
  warningDesc: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
  },
  buttonDisconnect: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // === ARRIVED STYLES ===
  arrivedBox: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    alignItems: 'center',
  },
  arrivedIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  arrivedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 6,
  },
  arrivedDesc: {
    fontSize: 14,
    color: '#388E3C',
    textAlign: 'center',
  },
  // === NAV STATUS STYLES ===
  navStatusBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  navStatusTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
    color: '#1565C0',
  },
  navStatusDirection: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  navStatusValue: {
    fontWeight: 'bold',
    color: '#1565C0',
  },
  navStatusInfo: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  // === INFO & DEBUG ===
  infoBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    width: '100%',
  },
  infoTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
    color: '#1565C0',
  },
  infoDesc: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  debugBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#333',
    borderRadius: 8,
    width: '100%',
  },
  debugTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 5,
    color: '#4CAF50',
  },
  debugDesc: {
    fontSize: 12,
    color: '#00FF00',
    marginBottom: 10,
  },
});

export default HomeScreen;
