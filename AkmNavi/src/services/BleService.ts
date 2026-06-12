import { BleManager, Device, State, BleError } from 'react-native-ble-plx';
import { encode } from 'base-64';

const SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const CHARACTERISTIC_UUID_RX = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';

class BleService {
  private manager: BleManager;
  private connectedDevice: Device | null = null;
  public onConnectionStatusChange?: (isConnected: boolean) => void;

  constructor() {
    this.manager = new BleManager();
  }

  // Cek state BLE
  public async getBluetoothState(): Promise<State> {
    return await this.manager.state();
  }

  public isDeviceConnected(): boolean {
    return this.connectedDevice !== null;
  }

  // Mulai memindai perangkat BLE dan langsung connect jika ketemu AKM_Navi
  public scanAndConnect(onStatusUpdate: (msg: string) => void) {
    onStatusUpdate('Mencari perangkat AKM_Navi...');
    
    let isConnecting = false;

    this.manager.startDeviceScan(null, null, async (error, device) => {
      if (error) {
        console.error('BLE Scan Error:', error);
        onStatusUpdate(`Scan Error: ${error.message}`);
        return;
      }

      // Pastikan kita menemukan nama device yang tepat
      if (device && device.name === 'AKM_Navi') {
        if (isConnecting) return;
        isConnecting = true;
        
        this.manager.stopDeviceScan(); // Stop scan karena device ketemu
        onStatusUpdate('AKM_Navi ditemukan. Menghubungkan...');
        
        try {
          // Tambahkan timeout atau pengaturan koneksi jika diperlukan
          const connectedDevice = await device.connect();
          onStatusUpdate('Terhubung ke perangkat. Menyusun layanan...');
          
          // Request MTU (opsional tapi membantu sinkronisasi di Android)
          try {
            await connectedDevice.requestMTU(128);
          } catch(e) {}

          const deviceWithServices = await connectedDevice.discoverAllServicesAndCharacteristics();
          this.connectedDevice = deviceWithServices;
          
          // Debugging: Cek service apa saja yang ditemukan
          const services = await deviceWithServices.services();
          const serviceUuids = services.map(s => s.uuid).join(', ');
          console.log('Discovered Services:', serviceUuids);

          onStatusUpdate('Layanan siap!');

          if (this.onConnectionStatusChange) {
            this.onConnectionStatusChange(true);
          }

          // Dengarkan jika putus koneksi
          const subscription = this.connectedDevice.onDisconnected((error, device) => {
            console.log('Device disconnected', error?.message);
            this.connectedDevice = null;
            if (this.onConnectionStatusChange) {
              this.onConnectionStatusChange(false);
            }
            subscription.remove();
          });
        } catch (err: any) {
          isConnecting = false;
          console.log('Connection error:', err);
          onStatusUpdate(`Koneksi Gagal: ${err.message}`);
        }
      }
    });

    // Otomatis stop scan setelah 15 detik jika tidak ketemu
    setTimeout(() => {
      this.manager.stopDeviceScan();
      if (!this.connectedDevice) {
        onStatusUpdate('Scan timeout. Perangkat tidak ditemukan.');
      }
    }, 15000);
  }

  // Putus koneksi
  public async disconnect() {
    if (this.connectedDevice) {
      await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      this.connectedDevice = null;
      if (this.onConnectionStatusChange) {
        this.onConnectionStatusChange(false);
      }
    }
  }

  // Kirim string payload (misal "KIRI|200m")
  public async sendCurrentPayload(payload: string): Promise<string> {
    if (!this.connectedDevice) return 'ERROR: Not connected';

    try {
      // react-native-ble-plx menerima string yang diencode dengan base64
      const base64Payload = encode(payload);
      
      // Gunakan WithoutResponse dari manager secara langsung
      await this.manager.writeCharacteristicWithoutResponseForDevice(
        this.connectedDevice.id,
        SERVICE_UUID.toLowerCase(),
        CHARACTERISTIC_UUID_RX.toLowerCase(),
        base64Payload
      );
      return `SUCCESS: ${payload}`;
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      console.log('Gagal mengirim payload via BLE:', errMsg);
      
      // Jika error mengatakan device not connected, bersihkan state
      if (errMsg.includes('not connected')) {
        this.connectedDevice = null;
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(false);
        }
      }
      return `ERROR: ${errMsg}`;
    }
  }
}

export default new BleService();
