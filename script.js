/**
 * Geliştirilmiş Kitap Barkod Okuma Sistemi (Barcode Scanner API ile)
 * Son Güncelleme: 2025-04-22
 */

// 📚 Örnek kitap verileri
const books = [
    { barcode: "9789750802942", title: "Saatleri Ayarlama Enstitüsü", author: "Ahmet Hamdi Tanpınar", price: "89.00 TL" },
    { barcode: "9786053758872", title: "Kürk Mantolu Madonna", author: "Sabahattin Ali", price: "75.00 TL" },
    { barcode: "9789750762246", title: "Simyacı", author: "Paulo Coelho", price: "79.90 TL" }
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
    let lastDetectedCode = null;
    let detectionCount = 0;
    const REQUIRED_DETECTION_COUNT = 3; // Aynı barkodun kaç kez doğrulanması gerektiği

    /**
     * Barkod tarama işlemini başlatır
     */
    function startScan() {
        if (isScanning) return;
        isScanning = true;
        scanAttempts = 0;
        lastDetectedCode = null;
        detectionCount = 0;
        statusEl.innerHTML = '<p class="scanning">📷 Barkodu kameraya gösterin</p>';
        clearUI();

        // Barkod Tarayıcı API'sini kontrol et
        if ('BarcodeDetector' in window) {
            startBarcodeScannerAPI();
        } else {
            statusEl.innerHTML = '<p class="error">❌ Barkod Tarayıcı API desteklenmiyor, QuaggaJS kullanılacak</p>';
            startQuaggaScanner(); // Fallback olarak QuaggaJS'yi başlat
        }
    }

    /**
     * Barkod Tarayıcı API'sini kullanarak tarama işlemini başlatır
     */
    function startBarcodeScannerAPI() {
        navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
            },
        })
            .then((stream) => {
                const track = stream.getVideoTracks()[0];
                const imageCapture = new ImageCapture(track);

                scannerEl.innerHTML = '<video id="video" width="100%" height="100%" style="display:block;"></video>';
                const videoElement = document.getElementById('video');
                videoElement.srcObject = stream;
                videoElement.play();

                const barcodeDetector = new BarcodeDetector({
                    formats: [
                        "ean_13",
                        "ean_8",
                        "code_128",
                        "upc_a",
                        "upc_e",
                        "qr_code", // QR kod ekledim
                        "code_39", //code 39 ekledim
                        "itf"
                    ],
                });

                const processFrame = () => {
                    if (!isScanning) {
                        stream.getTracks().forEach((track) => track.stop());
                        return;
                    }

                    imageCapture.grabFrame()
                        .then((image) => {
                            barcodeDetector.detect(image)
                                .then((barcodes) => {
                                    if (barcodes.length > 0) {
                                        const code = barcodes[0].rawValue;
                                        handleDetectedCode(code); // Doğrulama için fonksiyona gönder
                                        requestAnimationFrame(processFrame); // Tarama devam etsin
                                    } else {
                                        requestAnimationFrame(processFrame);
                                    }
                                })
                                .catch((err) => {
                                    console.error("Barkod algılama hatası:", err);
                                    requestAnimationFrame(processFrame); // Hata durumunda da taramaya devam et
                                });
                        })
                        .catch((err) => {
                            console.error("Görüntü yakalama hatası:", err);
                            statusEl.innerHTML = `<p class="error">❌ Görüntü yakalama hatası: ${err.message}</p>`;
                            stream.getTracks().forEach((track) => track.stop());
                            isScanning = false;
                        });
                };

                processFrame();
            })
            .catch((err) => {
                statusEl.innerHTML = '<p class="error">❌ Kamera başlatılamadı: ' + err.message + '</p>';
                console.error("Kamera Hatası:", err);
                isScanning = false;
            });
    }

    /**
     * QuaggaJS kütüphanesini kullanarak tarama işlemini başlatır (fallback olarak)
     */
    function startQuaggaScanner() {
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: scannerEl,
                constraints: {
                    width: { min: 800, ideal: 1280, max: 1920 },
                    height: { min: 600, ideal: 720, max: 1080 },
                    facingMode: "environment",
                    advanced: [{ focusMode: "continuous" }, { focusMode: "auto" }],
                },
                area: {
                    top: "20%",
                    right: "20%",
                    left: "20%",
                    bottom: "20%",
                },
            },
            locator: {
                patchSize: "medium",
                halfSample: true,
                debug: {
                    showCanvas: true,
                    showPatches: true,
                    showFoundPatches: true,
                },
            },
            numOfWorkers: navigator.hardwareConcurrency || 2,
            frequency: 15,
            decoder: {
                readers: [
                    "ean_reader",
                    "ean_8_reader",
                    "code_128_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "i2of5_reader",
                ],
                multiple: false,
                debug: {
                    drawBoundingBox: true,
                    showFrequency: true,
                    drawScanline: true,
                    showPattern: true,
                },
            },
            locate: true,
        }, (err) => {
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

        Quagga.onDetected((result) => {
            scanAttempts++;
            if (!result || !result.codeResult) return;
            const code = result.codeResult.code;
            const confidence = result.codeResult.confidence;
            console.log(`Quagga Algılama #${scanAttempts}: ${code} (${confidence.toFixed(2)})`);
            if (confidence > 0.8) {  // Yüksek güvenilirlik
                handleDetectedCode(code);
            }
            else {
                statusEl.innerHTML = `<p class="scanning">Düşük Güvenilirlik: ${code} (${confidence.toFixed(2)})</p>`;
            }

        });

        Quagga.onProcessed(handleProcessing);
        Quagga.onProcessed(trackBarcodePosition);
    }

    /**
     * Algılanan barkod kodunu işler ve doğrular
     * @param {string} code - Algılanan barkod kodu
     */
    function handleDetectedCode(code) {
        if (lastDetectedCode !== code) {
            lastDetectedCode = code;
            detectionCount = 1;
            statusEl.innerHTML = `<p class="scanning">Barkod algılandı: ${code} (${detectionCount}/${REQUIRED_DETECTION_COUNT} onay gerekiyor)</p>`;
        } else {
            detectionCount++;
            statusEl.innerHTML = `<p class="scanning">Barkod algılandı: ${code} (${detectionCount}/${REQUIRED_DETECTION_COUNT} onay gerekiyor)</p>`;
            if (detectionCount >= REQUIRED_DETECTION_COUNT) {
                acceptBarcode(code);
            }
        }
    }

    /**
     * Barkod doğrulandıktan sonraki işlemleri gerçekleştirir
     * @param {string} code - Algılanan barkod
     */
    function acceptBarcode(code) {
        playBeepSound();
        stopScanner();
        showResult(code);
        isScanning = false;
    }

    /**
     * Barkodun kamera görüntüsündeki pozisyonunu takip eder
     * ve kullanıcıya pozisyon ipuçları verir
     * @param {Object} result - İşleme sonucu (QuaggaJS için)
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
        let boxX = 0,
            boxY = 0;

        if (result.box) {
            // Kutunun merkez noktasını hesapla
            const centerPoint = result.box.reduce((acc, point) => {
                return [acc[0] + point[0] / 4, acc[1] + point[1] / 4];
            }, [0, 0]);

            boxX = centerPoint[0];
            boxY = centerPoint[1];

            // Kutu merkez alanda mı?
            hasBoxInCenter = (
                boxX > centerX - centerWidth / 2 &&
                boxX < centerX + centerWidth / 2 &&
                boxY > centerY - centerHeight / 2 &&
                boxY < centerY + centerHeight / 2
            );

            // Kullanıcıya pozisyon ipuçları ver
            if (!hasBoxInCenter) {
                let hint = "Barkodu merkeze getirin: ";

                if (boxY < centerY - centerHeight / 2) hint += "Aşağı ";
                else if (boxY > centerY + centerHeight / 2) hint += "Yukarı ";

                if (boxX < centerX - centerWidth / 2) hint += "Sağa ";
                else if (boxX > centerX + centerWidth / 2) hint += "Sola ";

                hint += "hareket ettirin";
                statusEl.innerHTML = `<p class="scanning">${hint}</p>`;
            } else {
                statusEl.innerHTML = '<p class="scanning">İyi! Barkodu sabit tutun...</p>';
            }
        }
    }

    /**
     * Görüntü işleme ve tarama visualizasyonu (QuaggaJS için)
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
            centerX - centerWidth / 2,
            centerY - centerHeight / 2,
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

        if ('BarcodeDetector' in window) {
            const videoElement = document.getElementById('video');
            if (videoElement && videoElement.srcObject) {
                const stream = videoElement.srcObject;
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());
            }
        }
        else {
            Quagga.stop();
            Quagga.offDetected();
            Quagga.offProcessed(handleProcessing);
            Quagga.offProcessed(trackBarcodePosition);
        }


        isScanning = false;
        const overlay = document.querySelector(".scanner-overlay");
        if (overlay) overlay.remove();
    }

    /**
     * UI'ı temizler
     */
    function clearUI() {
        resultEl.innerHTML = "";
        scannerEl.innerHTML = ""; //video elementini temizler
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
                setTimeout(startScan, 500);
            }
        });

        // Kamera sorunlarını otomatik algıla ve yeniden başlat
        setInterval(() => {
            if (isScanning && scanAttempts > 50) {
                console.log("Uzun süre algılama olmadı, tarayıcı yenileniyor...");
                stopScanner();
                setTimeout(startScan, 1000);
            }
        }, 10000);
    }

    // Uygulamayı başlat
    initApp();
});
