
# 🎯 Çivi Futbolu (Nail Football) ⚽

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.io-4.x-black.svg)](https://socket.io/)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-orange.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Çocukluğumuzun efsanevi ahşap masaüstü oyunu **Çivi Futbolu**, modern web teknolojileriyle dijital dünyaya taşındı! 

Tarayıcı üzerinden oynanabilen, sıfırdan yazılmış özel fizik motoruna sahip bu oyun ile ister arkadaşınızla aynı ekranda, isterseniz yerel ağ (LAN) üzerinden farklı cihazlarda karşılıklı maç yapabilirsiniz.

> *"Gerçekçi fiske hissiyatı, taktiksel çivi dizilimleri ve amansız rekabet!"*

---

## ✨ Özellikler

- **Sıfırdan Yazılmış Fizik Motoru:** Topun çivilere ve duvarlara çarpma tepkileri, sürtünme ve sekme dinamikleri tamamen özel olarak (hiçbir harici kütüphane kullanılmadan) geliştirildi.
- **Otoriter Sunucu (Authoritative Server):** Ağ üzerinden oynanan maçlarda tüm fizik hesaplamaları hileye karşı sunucuda yapılır, istemcilere sadece 60 FPS akıcılığında animasyon verisi gönderilir.
- **Çapraz Platform & Dokunmatik Desteği:** Mouse ile bilgisayarda veya dokunmatik ekranlı telefon/tabletlerde (Pointer Events API) kusursuz deneyim.
- **Farklı Saha Tasarımları:** Klasik, Zigzag, Kaotik, Elmas gibi farklı çivi dizilimlerine ve zorluk seviyelerine sahip çoklu harita seçenekleri.
- **İki Aşamalı Atış Mekaniği:** Tıpkı gerçekte olduğu gibi; önce atış yönünü belirle, ardından doğru gücü yakala ve vur!

## 🎮 Oyun Modları

1. **Aynı Ekranda Oyna (Hot-Seat):** Tek bir cihaz üzerinden arkadaşınızla sırayla oynayabileceğiniz mod.
2. **Yerel Ağda Oyna (LAN Multiplayer):** Aynı Wi-Fi/Ağ üzerindeki farklı cihazlardan sunucuya bağlanarak gerçek zamanlı karşılıklı oynama imkanı. Lobi ve oda kurma sistemi içerir.

---

## 📸 Ekran Görüntüleri

| Ana Menü | Saha Seçimi |
|:---:|:---:|
| <img src="https://via.placeholder.com/400x250/1a1a2e/FFFFFF?text=Ana+Menu+Goruntusu" alt="Ana Menü"> | <img src="https://via.placeholder.com/400x250/1a1a2e/FFFFFF?text=Saha+Secimi" alt="Saha Seçimi"> |

| Oyun İçi (Atış Anı) | Oyun İçi (Gol Animasyonu) |
|:---:|:---:|
| <img src="https://via.placeholder.com/400x250/2d8a4e/FFFFFF?text=Oyun+Ici+Goruntu" alt="Oyun İçi"> | <img src="https://via.placeholder.com/400x250/2d8a4e/FFFFFF?text=Gol+Animasyonu" alt="Gol Animasyonu"> |

*(Not: Proje tamamlandığında buralara kendi oyun içi ekran görüntülerini veya GIF'lerini ekleyebilirsin)*

---

## 🛠️ Kullanılan Teknolojiler

**Frontend (İstemci):**
- Vanilla JavaScript (ES6+)
- HTML5 Canvas 2D API (Render motoru)
- CSS3 (Responsive UI tasarımı)

**Backend (Sunucu):**
- Node.js
- Express.js (Statik dosya sunumu)
- Socket.IO (Gerçek zamanlı WebSocket iletişimi)

---

## 🚀 Kurulum ve Çalıştırma

Projeyi kendi bilgisayarınızda çalıştırmak oldukça basittir. 
```

**2. Bağımlılıkları yükleyin:**
```bash
npm install
```

**3. Sunucuyu başlatın:**
```bash
npm start
```
*(Sunucu varsayılan olarak `3000` portunda çalışacaktır.)*

**4. Oyuna Bağlanın:**
- Kendi bilgisayarınızdan oynamak için tarayıcınızda: `http://localhost:3000` adresine gidin.
- **Ağdaki başka bir cihazdan (örn: telefondan) oynamak için:** Sunucuyu çalıştırdığınız bilgisayarın yerel IP adresini bulun (Örn: `192.168.1.50`) ve telefondaki tarayıcıya `http://192.168.1.50:3000` yazın.

---

## 🕹️ Nasıl Oynanır?

Oyun **Sıra Tabanlıdır (Turn-based)**. Sıra size geldiğinde atışınızı iki aşamada yaparsınız:

1. **Yön Belirleme:** Ekrana dokunun (veya tıklayın). Topun etrafında dönen nişan okunu istediğiniz açıda durdurmak için tekrar dokunun.
2. **Güç Belirleme:** Yönü seçtikten sonra ekranda bir güç barı belirecek ve dolup boşalmaya başlayacaktır. İstediğiniz atış şiddetini yakaladığınız anda ekrana dokunarak topa vurun!

Top çivilere çarpa çarpa ilerler. Top tamamen durduğunda sıra diğer oyuncuya geçer. Topu rakip kaleden içeri sokan **1 Puan** kazanır!

---

## 📁 Proje Yapısı

```text
civi-futbolu/
├── server/                 # Backend kodları
│   ├── server.js           # Express ve Socket.IO ana giriş dosyası
│   ├── gameEngine.js       # Sunucu taraflı oyun mantığı otoritesi
│   ├── physics.js          # Çarpışma ve sekme hesaplamaları
│   └── fieldConfigs.js     # Harita (saha ve çivi) koordinat verileri
├── public/                 # Frontend kodları (Tarayıcıda çalışan kısım)
│   ├── index.html          # Ana oyun sayfası
│   ├── css/                # Stil dosyaları
│   ├── js/
│   │   ├── renderer.js     # Canvas çizim motoru
│   │   ├── input.js        # Mouse/Touch olay dinleyicileri
│   │   └── network.js      # Socket.IO istemci iletişimi
│   └── assets/             # Sesler, görseller ve ikonlar
└── package.json            # Proje bağımlılıkları
```

---

## 🗺️ Yol Haritası (Roadmap)

- [x] Temel fizik motorunun yazılması
- [x] HTML5 Canvas render sisteminin kurulması
- [x] İki aşamalı atış mekaniğinin geliştirilmesi
- [x] LAN Multiplayer (Socket.IO) entegrasyonu
- [ ] Ses efektleri ve görsel partikül efektleri eklenmesi (Geliştirilme Aşamasında)
- [ ] Global eşleştirme (Online Matchmaking) sistemi
- [ ] Kullanıcıların kendi sahalarını çizebileceği "Harita Editörü"

---

## 🤝 Katkıda Bulunma

Bu proje açık kaynaklıdır ve her türlü katkıya (Pull Request) açıktır. Yeni bir saha tasarımı eklemek, fizik motorunu iyileştirmek veya yeni özellikler katmak isterseniz:

1. Projeyi Fork'layın
2. Yeni bir dal (branch) oluşturun (`git checkout -b feature/YeniOzellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'Harika bir özellik eklendi'`)
4. Dalınıza push yapın (`git push origin feature/YeniOzellik`)
5. Bir Pull Request açın!

---

## 📜 Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır. Detaylar için `LICENSE` dosyasına göz atabilirsiniz.

---
*Eğer bu nostaljik projeyi beğendiyseniz, repoya bir ⭐ (Star) bırakmayı unutmayın! İyi eğlenceler!* ⚽
```
i canlı tutar.
