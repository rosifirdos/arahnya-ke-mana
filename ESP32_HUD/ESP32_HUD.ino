#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// Set the LCD address to 0x27 for a 16 chars and 2 line display
LiquidCrystal_I2C lcd(0x27, 16, 2);

// See the following for generating UUIDs:
// https://www.uuidgenerator.net/
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

bool deviceConnected = false;
bool oldDeviceConnected = false;

// Custom Characters (Icons)
byte PANAH_KIRI[8] = {
  0b00100,
  0b01100,
  0b11111,
  0b01100,
  0b00100,
  0b00000,
  0b00000,
  0b00000
};

byte PANAH_KANAN[8] = {
  0b00100,
  0b00110,
  0b11111,
  0b00110,
  0b00100,
  0b00000,
  0b00000,
  0b00000
};

byte PANAH_LURUS[8] = {
  0b00100,
  0b01110,
  0b11111,
  0b00100,
  0b00100,
  0b00100,
  0b00100,
  0b00000
};

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
    }

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string rxValue = pCharacteristic->getValue();

      if (rxValue.length() > 0) {
        Serial.println("Received Value: ");
        for (int i = 0; i < rxValue.length(); i++) {
          Serial.print(rxValue[i]);
        }
        Serial.println();
        
        // Convert to String for easier parsing
        String payload = String(rxValue.c_str());
        parseAndDisplay(payload);
      }
    }

    void parseAndDisplay(String payload) {
      // Expected format: "KIRI|200m"
      int delimiterIndex = payload.indexOf('|');
      if (delimiterIndex > 0) {
        String direction = payload.substring(0, delimiterIndex);
        String distance = payload.substring(delimiterIndex + 1);

        lcd.clear();
        lcd.setCursor(0, 0);

        if (direction == "KIRI") {
          lcd.write(0); // Custom char 0 = Panah Kiri
          lcd.print(" Belok Kiri");
        } else if (direction == "KANAN") {
          lcd.write(1); // Custom char 1 = Panah Kanan
          lcd.print(" Belok Kanan");
        } else if (direction == "LURUS") {
          lcd.write(2); // Custom char 2 = Panah Lurus
          lcd.print(" Lurus Terus");
        } else {
          // Unknown or other direction
          lcd.print(direction);
        }

        lcd.setCursor(0, 1);
        lcd.print("Jarak: ");
        lcd.print(distance);
      }
    }
};

void setup() {
  Serial.begin(115200);

  // Initialize LCD
  lcd.init();
  lcd.backlight();
  
  // Create Custom Characters
  lcd.createChar(0, PANAH_KIRI);
  lcd.createChar(1, PANAH_KANAN);
  lcd.createChar(2, PANAH_LURUS);

  lcd.setCursor(0, 0);
  lcd.print("Memulai BLE...");

  // Initialize BLE
  BLEDevice::init("AKM_Navi");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ |
                                         BLECharacteristic::PROPERTY_WRITE
                                       );

  pCharacteristic->setCallbacks(new MyCallbacks());
  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // functions that help with iPhone connections issue
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Menunggu Koneksi");
  Serial.println("Characteristic defined! Now you can read it in your phone!");
}

void loop() {
  // Handle disconnection
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // give the bluetooth stack the chance to get things ready
    BLEDevice::startAdvertising(); // restart advertising
    Serial.println("Start advertising");
    oldDeviceConnected = deviceConnected;
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Menunggu Koneksi");
  }
  
  // Handle connection
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Terhubung ke HP");
    delay(2000); // Tampilkan "Terhubung ke HP" selama 2 detik
    
    // Mode siaga navigasi
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Mode Siaga");
    lcd.setCursor(0, 1);
    lcd.print("Navigasi AKM");
  }
  
  delay(100);
}
