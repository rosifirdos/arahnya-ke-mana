import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BleService from '../services/BleService';

interface Props {
  onOpenScan: () => void;
}

const HomeScreen: React.FC<Props> = ({ onOpenScan }) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Listen to connection status
    BleService.onConnectionStatusChange = (status) => {
      setIsConnected(status);
    };
  }, []);

  const handleDisconnect = () => {
    BleService.disconnect();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AKM Navi</Text>
      
      <View style={styles.statusContainer}>
        <View style={[styles.indicator, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
        <Text style={styles.statusText}>
          {isConnected ? 'Terhubung ke ESP32' : 'Tidak Terhubung'}
        </Text>
      </View>

      {!isConnected ? (
        <TouchableOpacity style={styles.button} onPress={onOpenScan}>
          <Text style={styles.buttonText}>Scan Perangkat</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.button, styles.disconnectButton]} onPress={handleDisconnect}>
          <Text style={styles.buttonText}>Putuskan Koneksi</Text>
        </TouchableOpacity>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Info Navigasi:</Text>
        <Text style={styles.infoDesc}>
          1. Buka Google Maps dan mulai navigasi.{'\n'}
          2. Pastikan notifikasi rute Maps aktif.{'\n'}
          3. Aplikasi ini akan otomatis mengirim arah ke ESP32.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 30,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
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
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: '80%',
    alignItems: 'center',
  },
  disconnectButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    marginTop: 60,
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
  }
});

export default HomeScreen;
