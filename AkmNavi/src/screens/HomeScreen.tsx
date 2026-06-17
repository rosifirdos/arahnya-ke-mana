import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import BleService from '../services/BleService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatPayload } from '../utils/payloadFormatter';

const ICON_MAP_KEY = '@icon_direction_map';

const HomeScreen: React.FC = () => {
  const [isConnected, setIsConnected] = useState(BleService.isDeviceConnected());
  const [statusMessage, setStatusMessage] = useState('Siap memindai...');
  const [debugLog, setDebugLog] = useState('');
  const [payloadLog, setPayloadLog] = useState('Menunggu data...');
  const [currentIconHash, setCurrentIconHash] = useState('');
  const [isIconUnknown, setIsIconUnknown] = useState(false);
  const [mappingCount, setMappingCount] = useState(0);

  const loadMappings = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const raw = await AsyncStorage.getItem(ICON_MAP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

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

    // Load jumlah mapping awal
    loadMappings().then(m => setMappingCount(Object.keys(m).length));

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
          const iconHash = notifObj.iconHash || '';

          setCurrentIconHash(iconHash);

          // Cari arah dari pemetaan ikon
          let iconDirection: string | null = null;
          if (iconHash) {
            const mappings = await loadMappings();
            iconDirection = mappings[iconHash] || null;
            setIsIconUnknown(!iconDirection);
            // Update jumlah mapping
            setMappingCount(Object.keys(mappings).length);
          }

          const payload = formatPayload(title, text, subText, titleBig, iconDirection);

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

  // Handler kalibrasi: user menekan tombol arah untuk memetakan ikon saat ini
  const handleCalibrate = useCallback(async (direction: string) => {
    if (!currentIconHash) return;

    try {
      const mappings = await loadMappings();
      mappings[currentIconHash] = direction;
      await AsyncStorage.setItem(ICON_MAP_KEY, JSON.stringify(mappings));
      setIsIconUnknown(false);
      setMappingCount(Object.keys(mappings).length);

      // Langsung kirim payload yang sudah dikoreksi ke ESP32
      const log = await AsyncStorage.getItem('@last_notif');
      if (log && BleService.isDeviceConnected()) {
        const notifObj = JSON.parse(log);
        const payload = formatPayload(
          notifObj.title || '',
          notifObj.text || '',
          notifObj.subText || '',
          notifObj.titleBig || '',
          direction
        );
        if (payload) {
          const res = await BleService.sendCurrentPayload(payload);
          setPayloadLog(res);
        }
      }
    } catch (e: any) {
      console.warn('Failed to save calibration:', e);
    }
  }, [currentIconHash, loadMappings]);

  // Reset semua kalibrasi
  const handleClearMappings = useCallback(() => {
    Alert.alert(
      'Reset Kalibrasi',
      'Hapus semua pemetaan ikon? Anda perlu mengkalibrasi ulang saat navigasi berikutnya.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(ICON_MAP_KEY);
            setMappingCount(0);
            setIsIconUnknown(true);
          },
        },
      ]
    );
  }, []);

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

      {/* === KALIBRASI IKON NAVIGASI === */}
      {isConnected && currentIconHash ? (
        <View style={styles.calibrationBox}>
          <Text style={styles.calibrationTitle}>🎯 Kalibrasi Arah Navigasi</Text>
          <Text style={styles.calibrationHash}>Ikon: #{currentIconHash}</Text>
          <Text style={[
            styles.calibrationStatus,
            { color: isIconUnknown ? '#FF9800' : '#4CAF50' },
          ]}>
            {isIconUnknown ? '❓ Ikon belum dikenal — pilih arah di bawah' : '✅ Ikon sudah dipetakan'}
          </Text>

          {isIconUnknown && (
            <>
              <Text style={styles.calibrationPrompt}>
                Lihat panah di notifikasi Maps, lalu tekan arah yang benar:
              </Text>
              <View style={styles.calibrationButtons}>
                <TouchableOpacity
                  style={[styles.calBtn, { backgroundColor: '#2196F3' }]}
                  onPress={() => handleCalibrate('KIRI')}
                >
                  <Text style={styles.calBtnIcon}>←</Text>
                  <Text style={styles.calBtnLabel}>Kiri</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.calBtn, { backgroundColor: '#4CAF50' }]}
                  onPress={() => handleCalibrate('LURUS')}
                >
                  <Text style={styles.calBtnIcon}>↑</Text>
                  <Text style={styles.calBtnLabel}>Lurus</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.calBtn, { backgroundColor: '#FF9800' }]}
                  onPress={() => handleCalibrate('KANAN')}
                >
                  <Text style={styles.calBtnIcon}>→</Text>
                  <Text style={styles.calBtnLabel}>Kanan</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.calBtn, { backgroundColor: '#F44336' }]}
                  onPress={() => handleCalibrate('BALIK')}
                >
                  <Text style={styles.calBtnIcon}>↺</Text>
                  <Text style={styles.calBtnLabel}>Balik</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.mappingInfo}>
            <Text style={styles.mappingCount}>
              {mappingCount} ikon sudah dipetakan
            </Text>
            {mappingCount > 0 && (
              <TouchableOpacity onPress={handleClearMappings}>
                <Text style={styles.resetLink}>Reset Kalibrasi</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Info Navigasi:</Text>
        <Text style={styles.infoDesc}>
          1. Mulai Rute Navigasi di Google Maps.{'\n'}
          2. Saat ikon baru muncul (belum dikenal), pilih arah yang benar di panel Kalibrasi.{'\n'}
          3. Setelah semua ikon dikalibrasi (biasanya 4-6 ikon), arah otomatis terdeteksi.{'\n'}
          4. Kalibrasi disimpan permanen — tidak perlu diulang kecuali Google Maps update.
        </Text>
      </View>

      <View style={styles.debugBox}>
        <Text style={styles.debugTitle}>BLE TX Status:</Text>
        <Text style={styles.debugDesc}>{payloadLog}</Text>
        <Text style={styles.debugTitle}>Icon Hash:</Text>
        <Text style={styles.debugDesc}>{currentIconHash || '-'}</Text>
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
  // === KALIBRASI STYLES ===
  calibrationBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    width: '100%',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  calibrationTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
    color: '#F57F17',
  },
  calibrationHash: {
    fontSize: 12,
    color: '#795548',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  calibrationStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  calibrationPrompt: {
    fontSize: 13,
    color: '#555',
    marginBottom: 10,
  },
  calibrationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calBtn: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calBtnIcon: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
  },
  calBtnLabel: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    marginTop: 2,
  },
  mappingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mappingCount: {
    fontSize: 12,
    color: '#888',
  },
  resetLink: {
    fontSize: 12,
    color: '#F44336',
    textDecorationLine: 'underline',
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
