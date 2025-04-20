/**
 * Geliştirilmiş Kitap Barkod Okuma Sistemi
 * Son Güncelleme: 2025-04-20
 */

// 📚 Örnek kitap verileri
const books = [
    {
      barcode: "9789750802942",
      title: "Saatleri Ayarlama Enstitüsü",
      author: "Ahmet Hamdi Tanpınar",
      price: "89.00 TL"
    },
    {
      barcode: "9786053758872",
      title: "Kürk Mantolu Madonna",
      author: "Sabahattin Ali",
      price: "75.00 TL"
    },
    {
      barcode: "9789944886880",
      title: "Simyacı",
      author: "Paulo Coelho",
      price: "79.90 TL"
    }
  ];
  
  document.addEventListener("DOMContentLoaded", () => {
    // DOM elemanlarını seç
    const resultEl = document.getElementById("result");
    const scannerEl = document.getElementById("scanner-container");
    const statusEl = document.createElement("div");
    statusEl.className = "status";
    resultEl.parentNode.insertBefore(statusEl, resultEl);
  
    // Tarama durumunu izle
    let isScanning = false;
    let scanAttempts = 0;
    let lastDetections = {};
    
    // Sonuç güvenilirliği için gerekli minimum algılama sayısı
    const MIN_DETECTION_COUNT = 3;
    
    // Aynı barkod için maksimum algılama bekleme süresi (ms)
    const DETECTION_TIMEOUT = 2000;
  
    /**
     * Barkod tarama işlemini başlatır - Geliştirilmiş ayarlarla
     */
    function startScan() {
      if (isScanning) return;
      
      isScanning = true;
      scanAttempts = 0;
      lastDetections = {};
      
      statusEl.innerHTML = '<p class="scanning">📷 Kameraya barkodu gösterin</p>';
      clearUI();
  
      // Quagga yapılandırmasını optimize edelim
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: scannerEl,
          constraints: { 
            // Yüksek çözünürlük kullan
            width: { min: 800, ideal: 1280, max: 1920 },
            height: { min: 600, ideal: 720, max: 1080 },
            facingMode: "environment",
            // Daha iyi odaklama için
            advanced: [{ focusMode: "continuous" }]
          },
          area: { // Tarama alanını sınırla (merkezde)
            top: "20%",
            right: "20%", 
            left: "20%", 
            bottom: "20%"
          }
        },
        locator: {
          patchSize: "medium",
          halfSample: true,
          debug: {
            showCanvas: true,
            showPatches: true,
            showFoundPatches: true
          }
        },
        numOfWorkers: navigator.hardwareConcurrency || 2,
        frequency: 15, // Saniyede daha fazla tarama
        decoder: {
          readers: [
            // EAN formatları ve yaygın kitap barkod formatları
            "ean_reader",
            "ean_8_reader",
            "code_128_reader",
            "upc_reader",
            "upc_e_reader",
            "i2of5_reader"
          ],
          multiple: false, // Tek seferde tek barkod
          debug: {
            drawBoundingBox: true,
            showFrequency: true,
            drawScanline: true,
            showPattern: true
          }
        },
        locate: true
      }, err => {
        if (err) {
          statusEl.innerHTML = '<p class="error">❌ Kamera başlatılamadı: ' + err.message + '</p>';
          console.error("Kamera Hatası:", err);
          isScanning = false;
          return;
        }
        
        Quagga.start();
        addScanOverlay();
        statusEl.innerHTML = '<p class="scanning">📷 Tarama başlatıldı - Barkodu yavaşça yaklaştırın</p>';
      });
  
      // Barkod algılama event listenerı - güvenilirlik kontrolüyle
      Quagga.onDetected(handleDetection);
      
      // Hata ve işleme event listenerları
      Quagga.onProcessed(handleProcessing);
      Quagga.onProcessed(trackBarcodePosition);
    }
  
    /**
     * Barkod algılama sonuçlarını izler ve güvenilirlik kontrolü yapar
     * @param {Object} result - Quagga tarafından algılanan sonuç
     */
    function handleDetection(result) {
      scanAttempts++;
      
      if (!result || !result.codeResult) return;
      
      const code = result.codeResult.code;
      const confidence = result.codeResult.confidence;
      
      // Konsola algılama bilgilerini yaz (geliştirme için)
      console.log(`Algılama #${scanAttempts}: ${code} (${confidence.toFixed(2)})`);
      
      // Güvenilirlik skoru düşükse yoksay
      if (confidence < 0.10) {
        statusEl.innerHTML = '<p class="scanning">Netlik düşük, lütfen barkodu yaklaştırın...</p>';
        return;
      }
      
      // Bu barkodu takip etmeye başla veya sayacı artır
      if (!lastDetections[code]) {
        lastDetections[code] = {
          count: 1,
          firstSeen: Date.now(),
          lastConfidence: confidence
        };
      } else {
        lastDetections[code].count++;
        lastDetections[code].lastConfidence = Math.max(lastDetections[code].lastConfidence, confidence);
      }
      
      // Güvenilirlik kontrolü: Aynı kodu MIN_DETECTION_COUNT kez algıladık mı?
      const detection = lastDetections[code];
      
      // Zaman aşımı kontrolü
      const elapsed = Date.now() - detection.firstSeen;
      if (elapsed > DETECTION_TIMEOUT) {
        delete lastDetections[code]; // Eskidi, yeniden başlat
        return;
      }
      
      // Durum güncellemesi
      if (detection.count < MIN_DETECTION_COUNT) {
        statusEl.innerHTML = `<p class="scanning">Barkod bulundu: ${code} (${detection.count}/${MIN_DETECTION_COUNT} onay)</p>`;
        return;
      }
      
      // Minimum algılama sayısına ulaştık, barkodu kabul et
      acceptBarcode(code, detection.lastConfidence);
    }
  
    /**
     * Doğrulanmış bir barkodu kabul eder ve sonuçları gösterir
     * @param {string} code - Algılanan barkod
     * @param {number} confidence - Son güvenilirlik skorı
     */
    function acceptBarcode(code, confidence) {
      // Okuma başarılı ses efekti
      playBeepSound();
      
      // Kamerayı durdur ve sonucu göster
      stopScanner();
      showResult(code);
      
      // Durum bilgisini güncelle
      statusEl.innerHTML = `<p class="success">✅ Barkod başarıyla tarandı (${(confidence*100).toFixed(1)}% güvenilirlik)</p>`;
    }
  
    /**
     * Barkodun kamera görüntüsündeki pozisyonunu takip eder
     * ve kullanıcıya pozisyon ipuçları verir
     * @param {Object} result - İşleme sonucu
     */
    function trackBarcodePosition(result) {
      if (!result || !result.boxes) return;
      
      // Kamera görüntüsünün boyutlarını al
      const canvas = document.querySelector('#scanner-container canvas.drawingBuffer');
      if (!canvas) return;
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Merkez alanı tanımla (ekranın %30'u)
      const centerX = width / 2;
      const centerY = height / 2;
      const centerWidth = width * 0.3;
      const centerHeight = height * 0.3;
      
      // Algılanan kutuları kontrol et
      let hasBoxInCenter = false;
      let boxX = 0, boxY = 0;
      
      if (result.box) {
        // Kutunun merkez noktasını hesapla
        const centerPoint = result.box.reduce((acc, point) => {
          return [acc[0] + point[0]/4, acc[1] + point[1]/4];
        }, [0, 0]);
        
        boxX = centerPoint[0];
        boxY = centerPoint[1];
        
        // Kutu merkez alanda mı?
        hasBoxInCenter = (
          boxX > centerX - centerWidth/2 && 
          boxX < centerX + centerWidth/2 &&
          boxY > centerY - centerHeight/2 && 
          boxY < centerY + centerHeight/2
        );
        
        // Kullanıcıya pozisyon ipuçları ver
        if (!hasBoxInCenter) {
          let hint = "Barkodu merkeze getirin: ";
          
          if (boxY < centerY - centerHeight/2) hint += "Aşağı ";
          else if (boxY > centerY + centerHeight/2) hint += "Yukarı ";
          
          if (boxX < centerX - centerWidth/2) hint += "Sağa ";
          else if (boxX > centerX + centerWidth/2) hint += "Sola ";
          
          hint += "hareket ettirin";
          statusEl.innerHTML = `<p class="scanning">${hint}</p>`;
        } else {
          statusEl.innerHTML = '<p class="scanning">İyi! Barkodu sabit tutun...</p>';
        }
      }
    }
  
    /**
     * Görüntü işleme ve tarama visualizasyonu
     * @param {Object} result - İşleme sonucu
     */
    function handleProcessing(result) {
      if (!result) return;
      
      const canvas = document.querySelector('#scanner-container canvas.drawingBuffer');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;
      
      // Merkez hedef alanını çiz
      ctx.clearRect(0, 0, width, height);
      
      // Algılanan barkodları vurgula
      if (result.boxes) {
        result.boxes.filter(box => box !== result.box).forEach(box => {
          drawCanvasLines(ctx, box, '#2ecc71', 2);
        });
      }
      
      if (result.box) {
        drawCanvasLines(ctx, result.box, '#e74c3c', 3);
      }
      
      // Tarama alanını vurgula
      ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
      ctx.lineWidth = 2;
      
      // Merkezde tarama alanı
      const centerX = width / 2;
      const centerY = height / 2;
      const centerWidth = width * 0.3;
      const centerHeight = height * 0.3;
      
      ctx.beginPath();
      ctx.rect(
        centerX - centerWidth/2,
        centerY - centerHeight/2,
        centerWidth,
        centerHeight
      );
      ctx.stroke();
    }
    
    /**
     * Canvas üzerine kutu çizer
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Array} box - Kutu koordinatları
     * @param {string} color - Çizgi rengi
     * @param {number} lineWidth - Çizgi kalınlığı
     */
    function drawCanvasLines(ctx, box, color, lineWidth) {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      ctx.beginPath();
      
      const lastPoint = box[box.length - 1];
      ctx.moveTo(lastPoint[0], lastPoint[1]);
      
      box.forEach(point => {
        ctx.lineTo(point[0], point[1]);
      });
      
      ctx.stroke();
    }
  
    /**
     * Tarayıcı üzerine hedef katmanı ekler
     */
    function addScanOverlay() {
      const overlay = document.createElement("div");
      overlay.className = "scanner-overlay";
      overlay.innerHTML = `
        <div class="scanner-target">
          <div class="scanner-corners top-left"></div>
          <div class="scanner-corners top-right"></div>
          <div class="scanner-corners bottom-left"></div>
          <div class="scanner-corners bottom-right"></div>
        </div>
        <div class="scanner-guidance">Barkodu hedef alanın içine getirin</div>
      `;
      scannerEl.appendChild(overlay);
    }
  
    /**
     * Bip sesi çalar
     */
    function playBeepSound() {
      const beep = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU==");
      beep.volume = 0.2;
      beep.play().catch(err => console.log("Ses çalma hatası:", err));
    }
  
    /**
     * Tarayıcıyı durdurur
     */
    function stopScanner() {
      if (!isScanning) return;
      
      Quagga.stop();
      Quagga.offDetected(handleDetection);
      Quagga.offProcessed(handleProcessing);
      Quagga.offProcessed(trackBarcodePosition);
      
      // Tarayıcı durumunu güncelle
      isScanning = false;
      
      // Tarayıcı overlay'ini temizle
      const overlay = document.querySelector(".scanner-overlay");
      if (overlay) overlay.remove();
    }
  
    /**
     * UI'ı temizler
     */
    function clearUI() {
      resultEl.innerHTML = "";
    }
  
    /**
     * Sonuçları ekrana basar ve butonları ekler
     * @param {string} code - Algılanan barkod
     */
    function showResult(code) {
      // Veri tabanında kitabı ara
      const book = books.find(b => b.barcode === code);
      
      if (book) {
        resultEl.innerHTML = `
          <div class="book-result">
            <h2 class="book-title">📘 ${book.title}</h2>
            <div class="book-details">
              <p><strong>Yazar:</strong> ${book.author}</p>
              <p><strong>Barkod:</strong> ${code}</p>
              <p><strong>Fiyat:</strong> ${book.price}</p>
            </div>
            <button id="scan-again" class="action-button">Yeni Kitap Tara</button>
          </div>
        `;
      } else {
        resultEl.innerHTML = `
          <div class="book-not-found">
            <h2>Kitap Bulunamadı</h2>
            <p>❌ "${code}" barkodlu kitap sistemde kayıtlı değil.</p>
            <button id="add-book" class="action-button secondary">Kitap Ekle</button>
            <button id="scan-again" class="action-button">Tekrar Dene</button>
          </div>
        `;
        
        // Kitap ekleme butonu event listener'ı
        document.getElementById("add-book")?.addEventListener("click", () => {
          showAddBookForm(code);
        });
      }
      
      // Yeniden tarama butonu event listener'ı
      document.getElementById("scan-again")?.addEventListener("click", resetAndScan);
    }
  
    /**
     * Yeni kitap ekleme formu gösterir
     * @param {string} barcode - Eklenen kitabın barkodu
     */
    function showAddBookForm(barcode) {
      resultEl.innerHTML = `
        <div class="add-book-form">
          <h2>Yeni Kitap Ekle</h2>
          <form id="book-form">
            <div class="form-group">
              <label for="barcode">Barkod:</label>
              <input type="text" id="barcode" value="${barcode}" readonly>
            </div>
            <div class="form-group">
              <label for="title">Kitap Adı:</label>
              <input type="text" id="title" required>
            </div>
            <div class="form-group">
              <label for="author">Yazar:</label>
              <input type="text" id="author" required>
            </div>
            <div class="form-group">
              <label for="price">Fiyat (TL):</label>
              <input type="number" id="price" min="0" step="0.01" required>
            </div>
            <div class="form-actions">
              <button type="button" id="cancel-add" class="action-button secondary">İptal</button>
              <button type="submit" class="action-button">Kitabı Kaydet</button>
            </div>
          </form>
        </div>
      `;
      
      // Form event listener'ları
      document.getElementById("book-form").addEventListener("submit", (e) => {
        e.preventDefault();
        addNewBook(barcode);
      });
      
      document.getElementById("cancel-add").addEventListener("click", () => {
        resetAndScan();
      });
    }
  
    /**
     * Yeni kitap ekler
     * @param {string} barcode - Eklenen kitabın barkodu
     */
    function addNewBook(barcode) {
      const newBook = {
        barcode: barcode,
        title: document.getElementById("title").value,
        author: document.getElementById("author").value,
        price: document.getElementById("price").value + " TL"
      };
      
      // Kitabı koleksiyona ekle
      books.push(newBook);
      
      // Başarı mesajı göster
      statusEl.innerHTML = '<p class="success">✅ Kitap başarıyla eklendi</p>';
      
      // Eklenen kitabın detaylarını göster
      showResult(barcode);
      
      // Konsola eklenen kitap bilgisini yaz (gerçek uygulamada veritabanına kaydedilir)
      console.log("Yeni kitap eklendi:", newBook);
    }
  
    /**
     * Sonucu temizler ve yeniden taramayı başlatır
     */
    function resetAndScan() {
      clearUI();
      stopScanner();
      startScan();
    }
  
    /**
     * Manuel barkod girişi için form gösterir
     */
    function showManualEntryForm() {
      stopScanner();
      
      resultEl.innerHTML = `
        <div class="manual-entry-form">
          <h2>Manuel Barkod Giriş</h2>
          <p>Kamera ile tarama yapılamıyorsa, barkodu manuel olarak girin:</p>
          <form id="manual-form">
            <div class="form-group">
              <label for="manual-barcode">Barkod Numarası:</label>
              <input type="text" id="manual-barcode" required pattern="[0-9]{8,13}" 
                     placeholder="8-13 haneli barkod numarası">
            </div>
            <div class="form-actions">
              <button type="button" id="cancel-manual" class="action-button secondary">İptal</button>
              <button type="submit" class="action-button">Ara</button>
            </div>
          </form>
        </div>
      `;
      
      // Form event listener'ları
      document.getElementById("manual-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const manualCode = document.getElementById("manual-barcode").value;
        showResult(manualCode);
      });
      
      document.getElementById("cancel-manual").addEventListener("click", () => {
        resetAndScan();
      });
    }
  
    /**
     * Uygulamayı başlat ve kontrolleri ekle
     */
    function initApp() {
      // Başlangıç durum mesajı
      statusEl.innerHTML = '<p>Uygulama başlatılıyor...</p>';
      
      // Manuel giriş butonu ekle
      const appHeader = document.querySelector(".app-header");
      const manualEntryBtn = document.createElement("button");
      manualEntryBtn.className = "manual-entry-button";
      manualEntryBtn.textContent = "Manuel Giriş";
      manualEntryBtn.addEventListener("click", showManualEntryForm);
      appHeader.appendChild(manualEntryBtn);
      
      // Tarayıcı yardım ipuçları
      const tipEl = document.createElement("div");
      tipEl.className = "scan-tips";
      tipEl.innerHTML = `
        <h3>Barkod Tarama İpuçları:</h3>
        <ul>
          <li>Barkodu kameraya düz tutun</li>
          <li>İyi aydınlatılmış ortamda tarayın</li>
          <li>Barkodun tamamının görünür olduğundan emin olun</li>
          <li>Tarama sırasında sabit durun</li>
        </ul>
      `;
      resultEl.parentNode.insertBefore(tipEl, resultEl);
      
      // Taramayı başlat
      startScan();
      
      // Ekranı yönlendirme değişikliğini dinle ve yeniden boyutlandır
      window.addEventListener('resize', () => {
        if (isScanning) {
          stopScanner();
          setTimeout(startScan, 500); // Biraz bekleyip yeniden başlat
        }
      });
      
      // Kamera sorunlarını otomatik algıla ve yeniden başlat
      setInterval(() => {
        if (isScanning && scanAttempts > 50 && Object.keys(lastDetections).length === 0) {
          console.log("Uzun süre algılama olmadı, tarayıcı yenileniyor...");
          stopScanner();
          setTimeout(startScan, 1000);
        }
      }, 10000); // Her 10 saniyede bir kontrol et
    }
  
    // Uygulamayı başlat
    initApp();
  });