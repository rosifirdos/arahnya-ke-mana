import { BleManager, Device, BleError } from 'react-native-ble-plx';
import { encode } from 'base-64';

export const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const DEVICE_NAME = 'AKM_Navi';

class BleService {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  
  // Callback untuk meng-update UI
  public onDeviceFound?: (device: Device) => void;
  public onConnectionStatusChange?: (isConnected: boolean) => void;

  constructor() {
    this.manager = new BleManager();
  }

  // Mulai memindai perangkat BLE
  scanForDevices() {
    this.manager.startDeviceScan(null, null, (error: BleError | null, device: Device | null) => {
      if (error) {
        console.error('BLE Scan error:', error);
        return;
      }
      
      // Jika menemukan perangkat ESP32 kita (berdasarkan nama atau UUID service)
      if (device && (device.name === DEVICE_NAME || device.localName === DEVICE_NAME)) {
        if (this.onDeviceFound) {
          this.onDeviceFound(device);
        }
      }
    });
  }

  stopScan() {
    this.manager.stopDeviceScan();
  }

  // Hubungkan ke perangkat
  async connectToDevice(device: Device): Promise<boolean> {
    try {
      this.stopScan();
      const connected = await device.connect();
      const discovered = await connected.discoverAllServicesAndCharacteristics();
      this.connectedDevice = discovered;
      
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange(true);
      }

      // Monitor jika koneksi terputus untuk auto-reconnect
      this.manager.onDeviceDisconnected(device.id, (error, device) => {
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(false);
        }
        this.connectedDevice = null;
        console.log('Perangkat terputus. Mencoba reconnect otomatis...');
        // Coba konek ulang
        this.autoReconnect(device.id);
      });

      return true;
    } catch (e) {
      console.error('Gagal connect', e);
      return false;
    }
  }

  // Disconnect manual
  async disconnect() {
    if (this.connectedDevice) {
      await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      this.connectedDevice = null;
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange(false);
      }
    }
  }

  // Auto reconnect (sederhana)
  private async autoReconnect(deviceId: string) {
    let connected = false;
    let attempts = 0;
    while (!connected && attempts < 5) { // Coba 5 kali
      try {
        attempts++;
        const device = await this.manager.connectToDevice(deviceId);
        const discovered = await device.discoverAllServicesAndCharacteristics();
        this.connectedDevice = discovered;
        connected = true;
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(true);
        }
        console.log('Berhasil reconnect');
      } catch (e) {
        console.log(`Gagal reconnect ke-${attempts}. Menunggu 3 detik...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  // Fungsi untuk mengirim string payload
  async sendCurrentPayload(payload: string) {
    if (!this.connectedDevice) {
      console.log('Tidak ada perangkat tersambung untuk mengirim payload.');
      return;
    }

    try {
      // Data harus di-encode ke Base64 sebelum dikirim
      const base64Payload = encode(payload);
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        base64Payload
      );
      console.log('Payload terkirim:', payload);
    } catch (error) {
      console.error('Gagal mengirim payload', error);
    }
  }
}

export default new BleService();
