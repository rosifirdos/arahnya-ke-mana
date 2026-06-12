import { BleManager, Device, State } from 'react-native-ble-plx';
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

  // Pastikan Bluetooth dalam keadaan aktif sebelum scan
  private async waitForPoweredOn(): Promise<boolean> {
    return new Promise((resolve) => {
      const subscription = this.manager.onStateChange((state) => {
        console.log('BLE State:', state);
        if (state === State.PoweredOn) {
          subscription.remove();
          resolve(true);
        }
      }, true);

      // Timeout 10 detik
      setTimeout(() => {
        subscription.remove();
        resolve(false);
      }, 10000);
    });
  }

  // Mulai memindai perangkat BLE
  async scanForDevices() {
    console.log('Memulai scan BLE...');
    
    // Tunggu sampai Bluetooth menyala
    const isReady = await this.waitForPoweredOn();
    if (!isReady) {
      console.error('Bluetooth tidak aktif atau timeout');
      return;
    }

    console.log('Bluetooth aktif, mulai scanning...');
    
    this.manager.startDeviceScan(
      null, // Scan semua service UUID
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          console.error('BLE Scan error:', error.message);
          return;
        }
        
        if (device) {
          // Log semua perangkat ditemukan (untuk debugging)
          if (device.name || device.localName) {
            console.log('Perangkat ditemukan:', device.name || device.localName, device.id);
          }

          // Filter hanya perangkat ESP32 kita
          if (device.name === DEVICE_NAME || device.localName === DEVICE_NAME) {
            console.log('ESP32 AKM_Navi ditemukan!', device.id);
            if (this.onDeviceFound) {
              this.onDeviceFound(device);
            }
          }
        }
      }
    );

    // Auto-stop scan setelah 15 detik
    setTimeout(() => {
      this.stopScan();
      console.log('Scan dihentikan setelah 15 detik');
    }, 15000);
  }

  stopScan() {
    this.manager.stopDeviceScan();
  }

  // Hubungkan ke perangkat
  async connectToDevice(device: Device): Promise<boolean> {
    try {
      this.stopScan();
      console.log('Menghubungkan ke:', device.name || device.id);
      
      const connected = await device.connect({ timeout: 10000 });
      console.log('Terhubung, menemukan services...');
      
      const discovered = await connected.discoverAllServicesAndCharacteristics();
      this.connectedDevice = discovered;
      
      console.log('Services ditemukan, koneksi berhasil!');
      
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange(true);
      }

      // Monitor jika koneksi terputus untuk auto-reconnect
      this.manager.onDeviceDisconnected(device.id, (_error, disconnectedDevice) => {
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(false);
        }
        this.connectedDevice = null;
        console.log('Perangkat terputus. Mencoba reconnect otomatis...');
        if (disconnectedDevice) {
          this.autoReconnect(disconnectedDevice.id);
        }
      });

      return true;
    } catch (e: any) {
      console.error('Gagal connect:', e?.message || e);
      return false;
    }
  }

  // Disconnect manual
  async disconnect() {
    if (this.connectedDevice) {
      try {
        await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      } catch (e) {
        console.warn('Error saat disconnect:', e);
      }
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
    while (!connected && attempts < 5) {
      try {
        attempts++;
        console.log(`Percobaan reconnect ke-${attempts}...`);
        const device = await this.manager.connectToDevice(deviceId);
        const discovered = await device.discoverAllServicesAndCharacteristics();
        this.connectedDevice = discovered;
        connected = true;
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(true);
        }
        console.log('Berhasil reconnect!');
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
      const base64Payload = encode(payload);
      await this.connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        base64Payload
      );
      console.log('Payload terkirim:', payload);
    } catch (error: any) {
      console.error('Gagal mengirim payload:', error?.message || error);
    }
  }
}

export default new BleService();
