/**
 * Geliştirilmiş Kitap Barkod Okuma Sistemi (Dynamsoft Barcode Reader ile)
 * Son Güncelleme: 2025-04-22
 */

// 📚 Örnek kitap verileri
const books = [
    { barcode: "9789750802942", title: "Saatleri Ayarlama Enstitüsü", author: "Ahmet Hamdi Tanpınar", price: "89.00 TL" },
    { barcode: "9786053758872", title: "Kürk Mantolu Madonna", author: "Sabahattin Ali", price: "75.00 TL" },
    { barcode: "9789944886880", title: "Simyacı", author: "Paulo Coelho", price: "79.90 TL" }
];

// Dynamsoft lisans anahtarınızı buraya girin
const DYNAMSOFT_LICENSE_KEY = "YOUR_LICENSE_KEY"; // !!! Lisans anahtarınızı buraya girin !!!

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
    let barcodeReaderInstance = null; // Dynamsoft Barcode Reader instance'ı

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

        // Dynamsoft Barcode Reader'ı başlat
        initDynamsoftScanner()
            .then(() => {
                if (barcodeReaderInstance) {
                    startDynamsoftScanning();
                }
            })
            .catch(error => {
                statusEl.innerHTML = `<p class="error">❌ Tarayıcı başlatılamadı: ${error.message}</p>`;
                console.error("Tarayıcı başlatma hatası:", error);
                isScanning = false;
            });
    }

    /**
     * Dynamsoft Barcode Reader'ı başlatır
     */
    function initDynamsoftScanner() {
        return new Promise((resolve, reject) => {
            if (barcodeReaderInstance) {
                resolve(); // Zaten başlatılmışsa resolve et
                return;
            }

            Dynamsoft.BarcodeReader.licenseKey = DYNAMSOFT_LICENSE_KEY;
            Dynamsoft.BarcodeReader.createInstance()
                .then(reader => {
                    barcodeReaderInstance = reader;
                    // barcodeReaderInstance. 엔진 ayarlarını burada yapabilirsiniz (örn. formatlar, vb.)
                    barcodeReaderInstance.updateRuntimeSettings({
                        "barcodeFormatIds": [
                            Dynamsoft.EnumBarcodeFormat.BF_EAN_13,
                            Dynamsoft.EnumBarcodeFormat.BF_EAN_8,
                            Dynamsoft.EnumBarcodeFormat.BF_CODE_128,
                            Dynamsoft.EnumBarcodeFormat.BF_UPC_A,
                            Dynamsoft.EnumBarcodeFormat.BF_UPC_E,
                            Dynamsoft.EnumBarcodeFormat.BF_QR_CODE,
                            Dynamsoft.EnumBarcodeFormat.BF_CODE_39,
                            Dynamsoft.EnumBarcodeFormat.BF_INTERLEAVED_25
                        ],
                        "deblurLevel": 3, // Görüntü netliğini artırır
                        "maxAlgorithmThreadCount": 4, // Performansı artırır
                    }).then(() => {
                         resolve();
                    }).catch((error) =>{
                        reject(error);
                    })

                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    /**
     * Dynamsoft Barcode Reader ile tarama işlemini başlatır
     */
    function startDynamsoftScanning() {
        scannerEl.innerHTML = '<video id="video" width="100%" height="100%" style="display:block;"></video>';
        const videoElement = document.getElementById('video');

        navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
            },
        })
            .then(stream => {
                videoElement.srcObject = stream;
                videoElement.play();

                const processFrame = () => {
                    if (!isScanning || !barcodeReaderInstance) {
                        stream.getTracks().forEach(track => track.stop());
                        if(barcodeReaderInstance){
                           barcodeReaderInstance.cancel(); // Mevcut taramayı iptal et
                        }
                        return;
                    }

                    barcodeReaderInstance.decodeVideo(videoElement)
                        .then(results => {
                            if (results.length > 0) {
                                const code = results[0].text;
                                handleDetectedCode(code); // Doğrulama için fonksiyona gönder
                            }
                            requestAnimationFrame(processFrame); // Bir sonraki kareyi işle
                        })
                        .catch(error => {
                            console.error("Barkod okuma hatası:", error);
                            if (error.message.includes("No barcode detected")) {
                                requestAnimationFrame(processFrame); // Barkod bulunamadı hatası ise taramaya devam et
                            } else {
                                statusEl.innerHTML = `<p class="error">❌ Barkod okuma hatası: ${error.message}</p>`;
                                stream.getTracks().forEach(track => track.stop());
                                isScanning = false;
                            }
                        });
                };

                processFrame(); // Tarama döngüsünü başlat
            })
            .catch(error => {
                statusEl.innerHTML = `<p class="error">❌ Kamera başlatılamadı: ${error.message}</p>`;
                console.error("Kamera hatası:", error);
                isScanning = false;
            });
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
     * Tarayıcıyı durdurur
     */
    function stopScanner() {
        if (!isScanning) return;

        isScanning = false;
        if (barcodeReaderInstance) {
            barcodeReaderInstance.cancel();    // Decode işlemini durdur.
            barcodeReaderInstance.close().then(()=>{
                barcodeReaderInstance = null;
            });
        }

        const videoElement = document.getElementById('video');
        if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
        }

        const overlay = document.querySelector(".scanner-overlay");
        if (overlay) overlay.remove();
    }

    /**
     * UI'ı temizler
     */
    function clearUI() {
        resultEl.innerHTML = "";
        scannerEl.innerHTML = ""; // Video elementini temizler
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
