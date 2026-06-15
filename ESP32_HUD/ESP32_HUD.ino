#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Konfigurasi LCD
LiquidCrystal_I2C lcd(0x27, 16, 2);

// UUID untuk Nordic UART Service
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E" // UART service UUID
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

BLEServer *pServer = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long connectedMsgTime = 0;
bool showConnectedMsg = false;

// Custom Characters (Panah)
byte arrowLeft[8] = {
  B00000,
  B00100,
  B01100,
  B11111,
  B01100,
  B00100,
  B00000,
  B00000
};

byte arrowRight[8] = {
  B00000,
  B00100,
  B00110,
  B11111,
  B00110,
  B00100,
  B00000,
  B00000
};

byte arrowStraight[8] = {
  B00100,
  B01110,
  B11111,
  B00100,
  B00100,
  B00100,
  B00100,
  B00000
};

byte arrowUTurn[8] = {
  B01110,
  B10001,
  B10001,
  B10101,
  B10111,
  B10000,
  B10000,
  B00000
};

// Callback untuk koneksi BLE
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("Device connected!");
      // Jangan gunakan delay() di dalam callback BLE!
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("Device disconnected!");
    }
};

void updateLCD(String payload);

// Callback untuk menerima data dari HP (RX)
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue().c_str();

      if (rxValue.length() > 0) {
        Serial.print("Received Value: ");
        Serial.println(rxValue);
        // Hapus trailing newline jika ada
        rxValue.trim();
        updateLCD(rxValue);
      }
    }
};

void setup() {
  Serial.begin(115200);

  // Inisialisasi LCD
  lcd.init();
  lcd.backlight();
  
  // Daftarkan Custom Character ke CGRAM LCD (Maksimal 8 karakter, ID 0-7)
  lcd.createChar(0, arrowLeft);
  lcd.createChar(1, arrowRight);
  lcd.createChar(2, arrowStraight);
  lcd.createChar(3, arrowUTurn);

  lcd.setCursor(0, 0);
  lcd.print("Menyiapkan BLE..");

  // Inisialisasi BLE
  BLEDevice::init("AKM_Navi");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
      CHARACTERISTIC_UUID_RX,
      BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxCharacteristic->setCallbacks(new MyCallbacks());

  // Memulai service
  pService->start();

  // Memulai advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // Bantu koneksi ke iPhone
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("BLE Advertising Started!");
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Menunggu Koneksi");
  lcd.setCursor(0, 1);
  lcd.print("BLE...");
}

void loop() {
  // Handle state saat baru saja terhubung
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = true;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Terhubung ke HP");
    
    connectedMsgTime = millis();
    showConnectedMsg = true;
  }

  // Handle pergantian pesan setelah 2 detik tanpa memblokir BLE
  if (deviceConnected && showConnectedMsg && (millis() - connectedMsgTime >= 2000)) {
    showConnectedMsg = false;
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Siaga Navigasi");
  }

  // Handle state saat terputus
  if (!deviceConnected && oldDeviceConnected) {
    oldDeviceConnected = false;
    showConnectedMsg = false;
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Koneksi Terputus");
    lcd.setCursor(0, 1);
    lcd.print("Menunggu BLE...");
    
    delay(500); // delay singkat aman sebelum advertising lagi
    pServer->startAdvertising(); 
    Serial.println("BLE Advertising Started again!");
  }

  delay(50);
}

// Format payload: "ARAH|JARAK" (contoh: "KIRI|200m")
void updateLCD(String payload) {
  int separatorIndex = payload.indexOf('|');
  if (separatorIndex == -1) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(payload); // Print raw string if no separator
    return;
  }

  String direction = payload.substring(0, separatorIndex);
  String distance = payload.substring(separatorIndex + 1);

  lcd.clear();
  
  // Baris 1: Ikon Panah & Arah Teks
  lcd.setCursor(0, 0);
  
  // Mencetak ikon custom berdasarkan teks arah
  if (direction == "KIRI") {
    lcd.write(0); // arrowLeft
  } else if (direction == "KANAN") {
    lcd.write(1); // arrowRight
  } else if (direction == "LURUS") {
    lcd.write(2); // arrowStraight
  } else if (direction == "BALIK") {
    lcd.write(3); // arrowUTurn
  } else if (direction == "BELOK") {
    // Jika tidak spesifik, berikan tanda tanya atau lurus (sesuai selera)
    lcd.write(2); 
  } else {
    // Jika arah tidak valid / kosong
    lcd.print("-"); 
  }

  lcd.setCursor(2, 0);
  if (direction.length() > 0 && direction != " ") {
    // Format huruf awal kapital agar bagus
    String dirText = direction;
    if (dirText == "BALIK") dirText = "Putar Balik";
    else if (dirText == "KIRI") dirText = "Belok Kiri";
    else if (dirText == "KANAN") dirText = "Belok Kanan";
    else if (dirText == "LURUS") dirText = "Terus Lurus";
    lcd.print(dirText);
  } else {
    lcd.print("Ikuti Jalan");
  }

  // Baris 2: Jarak
  lcd.setCursor(0, 1);
  lcd.print("Jarak: ");
  lcd.print(distance);
}
