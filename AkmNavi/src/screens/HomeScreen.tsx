import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Keyboard, ScrollView } from 'react-native';
import WifiService from '../services/WifiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HomeScreen: React.FC = () => {
  const [isConnected, setIsConnected] = useState(WifiService.isDeviceConnected());
  const [ipAddress, setIpAddress] = useState(WifiService.getIpAddress());
  const [isEditing, setIsEditing] = useState(false);
  const [debugLog, setDebugLog] = useState('');

  const checkConnection = useCallback(async () => {
    const status = await WifiService.checkConnection();
    setIsConnected(status);
  }, []);

  useEffect(() => {
    // Initial fetch of IP to sync state
    setIpAddress(WifiService.getIpAddress());
    checkConnection();

    WifiService.onConnectionStatusChange = (status) => {
      setIsConnected(status);
    };

    const interval = setInterval(() => {
      checkConnection();
      AsyncStorage.getItem('@last_notif').then(log => {
        if (log) setDebugLog(log);
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [checkConnection]);

  const handleSaveIp = async () => {
    Keyboard.dismiss();
    await WifiService.setIpAddress(ipAddress);
    setIsEditing(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AKM Navi (Hotspot Mode)</Text>
      
      <View style={styles.statusContainer}>
        <View style={[styles.indicator, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
        <Text style={styles.statusText}>
          {isConnected ? 'Terhubung ke ESP32' : 'Tidak Terhubung'}
        </Text>
      </View>

      <View style={styles.ipContainer}>
        <Text style={styles.ipLabel}>IP Address ESP32:</Text>
        {isEditing ? (
          <View style={styles.ipInputRow}>
            <TextInput
              style={styles.ipInput}
              value={ipAddress}
              onChangeText={setIpAddress}
              keyboardType="numeric"
              placeholder="192.168.43.51"
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveIp}>
              <Text style={styles.saveButtonText}>Simpan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ipInputRow}>
            <Text style={styles.ipValue}>{ipAddress}</Text>
            <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
              <Text style={styles.editButtonText}>Ubah</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!isConnected && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Cara Menghubungkan:</Text>
          <Text style={styles.warningDesc}>
            1. Nyalakan Hotspot HP Anda (Nama: AKM_Navi, Sandi: password123).{'\n'}
            2. Nyalakan alat ESP32.{'\n'}
            3. Tunggu hingga LCD ESP32 menampilkan angka IP (misal: 192.168.43.15).{'\n'}
            4. Klik 'Ubah' di atas dan masukkan angka IP tersebut.{'\n'}
            5. Klik 'Simpan' dan tunggu indikator menjadi Hijau.
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={checkConnection}>
        <Text style={styles.buttonText}>Refresh Status</Text>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Info Navigasi:</Text>
        <Text style={styles.infoDesc}>
          1. Keuntungan mode ini: Anda BISA memakai koneksi data seluler untuk Google Maps.{'\n'}
          2. Pastikan status berwarna Hijau.{'\n'}
          3. Buka Google Maps dan mulai rute navigasi.
        </Text>
      </View>

      <View style={styles.debugBox}>
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
  ipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ipValue: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
  },
  ipInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 16,
    marginRight: 10,
  },
  editButton: {
    backgroundColor: '#9E9E9E',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
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
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
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
  }
});

export default HomeScreen;
