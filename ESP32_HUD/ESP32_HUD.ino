#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WebServer.h>

// Konfigurasi WiFi Hotspot HP
const char* ssid = "AKM_Navi";
const char* password = "password123";

// LCD I2C setup
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer server(80);

void setup() {
  Serial.begin(115200);

  // Inisialisasi LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Menghubungkan...");
  lcd.setCursor(0, 1);
  lcd.print("Ke Hotspot HP");

  // Mulai koneksi WiFi sebagai Client (Station)
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    if(attempts > 30) {
      lcd.clear();
      lcd.setCursor(0,0);
      lcd.print("Hotspot tdk ada!");
      lcd.setCursor(0,1);
      lcd.print("Restart ESP...");
      delay(3000);
      ESP.restart(); // Restart jika gagal konek setelah 15 detik
    }
  }

  Serial.println("\nConnected to the WiFi network");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Tampilkan IP di LCD agar pengguna bisa mengetiknya di aplikasi
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connected!");
  lcd.setCursor(0, 1);
  lcd.print("IP: ");
  lcd.print(WiFi.localIP().toString());

  // Endpoint untuk menerima perintah navigasi
  server.on("/update", HTTP_POST, []() {
    if (server.hasArg("plain") == false) {
      server.send(400, "text/plain", "Body not received");
      return;
    }
    String message = server.arg("plain");
    Serial.print("Received Data: ");
    Serial.println(message);
    
    if (message == "PING") {
      server.send(200, "text/plain", "OK");
      return;
    }

    updateLCD(message);
    server.send(200, "text/plain", "Success");
  });

  server.begin();
}

void loop() {
  server.handleClient();
  
  // Jika koneksi WiFi terputus
  if(WiFi.status() != WL_CONNECTED) {
    lcd.clear();
    lcd.setCursor(0,0);
    lcd.print("Koneksi Putus!");
    lcd.setCursor(0,1);
    lcd.print("Menghubungkan...");
    WiFi.disconnect();
    WiFi.reconnect();
    delay(3000);
    
    if(WiFi.status() == WL_CONNECTED) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Tersambung Lagi!");
      lcd.setCursor(0, 1);
      lcd.print("IP:");
      lcd.print(WiFi.localIP().toString());
    }
  }
}

// Format payload: "DIRECTION|DISTANCE" (contoh: "KIRI|200m")
void updateLCD(String payload) {
  int separatorIndex = payload.indexOf('|');
  if (separatorIndex == -1) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(payload); // Print the raw string if no separator
    return;
  }

  String direction = payload.substring(0, separatorIndex);
  String distance = payload.substring(separatorIndex + 1);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Arah: ");
  lcd.print(direction);

  lcd.setCursor(0, 1);
  lcd.print("Jarak: ");
  lcd.print(distance);
}
