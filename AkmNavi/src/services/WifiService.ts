import AsyncStorage from '@react-native-async-storage/async-storage';

class WifiService {
  private espIp = '192.168.43.51'; // Default dummy, bisa diganti user
  private isConnected = false;

  public onConnectionStatusChange?: (isConnected: boolean) => void;

  constructor() {
    this.loadIpAddress();
  }

  public async loadIpAddress() {
    try {
      const savedIp = await AsyncStorage.getItem('@esp32_ip');
      if (savedIp !== null) {
        this.espIp = savedIp;
      }
    } catch (e) {
      console.error('Gagal load IP', e);
    }
  }

  public async setIpAddress(ip: string) {
    this.espIp = ip;
    try {
      await AsyncStorage.setItem('@esp32_ip', ip);
      // Langsung tes koneksi setelah ganti IP
      this.checkConnection();
    } catch (e) {
      console.error('Gagal simpan IP', e);
    }
  }

  public getIpAddress(): string {
    return this.espIp;
  }

  public isDeviceConnected(): boolean {
    return this.isConnected;
  }

  public async getEspIp(): Promise<string> {
    try {
      const savedIp = await AsyncStorage.getItem('@esp32_ip');
      if (savedIp) return savedIp;
    } catch (e) {}
    return this.espIp;
  }

  // Cek secara berkala apakah HP terhubung ke ESP32
  public async checkConnection(): Promise<boolean> {
    try {
      const ip = await this.getEspIp();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5 detik timeout
      
      const response = await fetch(`http://${ip}/update`, { 
        method: 'POST',
        body: 'PING', 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      const status = response.ok;
      if (this.isConnected !== status) {
        this.isConnected = status;
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(this.isConnected);
        }
      }
      return status;
    } catch (error) {
      if (this.isConnected !== false) {
        this.isConnected = false;
        if (this.onConnectionStatusChange) {
          this.onConnectionStatusChange(false);
        }
      }
      return false;
    }
  }

  // Kirim string payload
  public async sendCurrentPayload(payload: string) {
    try {
      const ip = await this.getEspIp();
      const response = await fetch(`http://${ip}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: payload
      });
      return response.ok;
    } catch (error: any) {
      console.error('Gagal mengirim payload via WiFi:', error?.message || error);
      return false;
    }
  }
}

export default new WifiService();
