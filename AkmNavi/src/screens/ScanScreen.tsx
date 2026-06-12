import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Device } from 'react-native-ble-plx';
import BleService, { DEVICE_NAME } from '../services/BleService';

interface Props {
  onClose: () => void;
}

const ScanScreen: React.FC<Props> = ({ onClose }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    startScan();
    return () => {
      BleService.stopScan();
    };
  }, []);

  const startScan = () => {
    setDevices([]);
    BleService.onDeviceFound = (device) => {
      setDevices((prev) => {
        // Hindari duplikasi
        const exists = prev.find(d => d.id === device.id);
        if (!exists) {
          return [...prev, device];
        }
        return prev;
      });
    };
    BleService.scanForDevices();
  };

  const handleConnect = async (device: Device) => {
    setIsConnecting(true);
    const success = await BleService.connectToDevice(device);
    setIsConnecting(false);
    
    if (success) {
      onClose(); // Kembali ke home
    } else {
      alert('Gagal terhubung ke perangkat');
    }
  };

  const renderItem = ({ item }: { item: Device }) => (
    <TouchableOpacity 
      style={styles.deviceCard} 
      onPress={() => handleConnect(item)}
      disabled={isConnecting}
    >
      <Text style={styles.deviceName}>{item.name || item.localName || 'Unknown Device'}</Text>
      <Text style={styles.deviceId}>{item.id}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'< Kembali'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pindai ESP32</Text>
      </View>

      {isConnecting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Menghubungkan...</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Mencari perangkat "{DEVICE_NAME}"...</Text>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {!isConnecting && (
        <TouchableOpacity style={styles.refreshBtn} onPress={startScan}>
          <Text style={styles.refreshBtnText}>Ulangi Pindai</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    marginRight: 20,
  },
  backBtnText: {
    fontSize: 16,
    color: '#2196F3',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  listContent: {
    padding: 20,
  },
  deviceCard: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  deviceId: {
    fontSize: 12,
    color: '#888',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  refreshBtn: {
    margin: 20,
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});

export default ScanScreen;
