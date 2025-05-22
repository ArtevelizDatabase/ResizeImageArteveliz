document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('imageUpload');
    const fileCountDisplay = document.getElementById('fileCountDisplay');
    const widthInput = document.getElementById('widthInput');
    const heightInput = document.getElementById('heightInput');
    const resizeAllButton = document.getElementById('resizeAllButton');
    const resizedImagesContainer = document.getElementById('resizedImagesContainer');
    const downloadAllButton = document.getElementById('downloadAllButton');
    const formatSelect = document.getElementById('formatSelect');
    const presetSelect = document.getElementById('presetSelect');
    const dropArea = document.getElementById('dropArea');

    let uploadedFiles = []; // Stores File objects from upload
    let resizedImagesData = []; // Stores { fileName, dataURL, blob } of resized images

    // --- Fungsi Umum untuk Memuat Objek Image dari File ---
    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image.'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file.'));
            reader.readAsDataURL(file);
        });
    }

    // --- Fungsi untuk Menggambar Gambar ke Canvas (individual) dan Menampilkan Pratinjau ---
    async function drawAndGetResizedImage(image, originalFileName, targetWidth, targetHeight, format) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;

        if (format === 'image/jpeg') {
            tempCtx.fillStyle = 'white';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        }

        tempCtx.drawImage(image, 0, 0, targetWidth, targetHeight);

        return new Promise(resolve => {
            tempCanvas.toBlob(blob => {
                if (!blob) { // Handle case where toBlob fails
                    console.error('Failed to create Blob for image:', originalFileName);
                    resolve(null);
                    return;
                }
                const dataURL = URL.createObjectURL(blob);

                // Buat elemen pratinjau di UI
                const imgItem = document.createElement('div');
                imgItem.className = 'resized-image-item';

                const previewCanvas = document.createElement('canvas');
                const previewCtx = previewCanvas.getContext('2d');
                
                // Ukuran thumbnail pratinjau agar tidak terlalu besar di UI
                const previewMaxSize = 150; 
                let pWidth = targetWidth;
                let pHeight = targetHeight;

                if (pWidth > previewMaxSize || pHeight > previewMaxSize) {
                    if (pWidth >= pHeight) { 
                        pHeight = (pHeight / pWidth) * previewMaxSize;
                        pWidth = previewMaxSize;
                    } else { 
                        pWidth = (pWidth / pHeight) * previewMaxSize;
                        pHeight = previewMaxSize;
                    }
                }
                previewCanvas.width = pWidth;
                previewCanvas.height = pHeight;
                previewCtx.drawImage(image, 0, 0, pWidth, pHeight); 
                
                imgItem.appendChild(previewCanvas);
                const fileNameP = document.createElement('p');
                fileNameP.textContent = originalFileName;
                imgItem.appendChild(fileNameP);

                resizedImagesContainer.appendChild(imgItem);

                resolve({
                    fileName: originalFileName,
                    dataURL: dataURL, // URL untuk download
                    blob: blob // Blob untuk potensi penggunaan di masa mendatang (misal: JSZip)
                });
            }, format); // Pastikan format yang diminta digunakan saat membuat blob
        });
    }

    // --- Fungsi Umum untuk Memproses File Gambar yang Diunggah ---
    async function processUploadedFiles(files) {
        uploadedFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

        if (uploadedFiles.length === 0) {
            fileCountDisplay.textContent = 'No valid images selected.';
            uploadedFiles = [];
            resizedImagesData = [];
            resizedImagesContainer.innerHTML = '<p class="placeholder-text">Upload images to start resizing!</p>';
            imageUpload.value = ''; // Reset input file
            return;
        }

        fileCountDisplay.textContent = `Selected ${uploadedFiles.length} image(s).`;
        resizedImagesContainer.innerHTML = ''; // Clear previous previews
        resizedImagesData = []; // Clear previous resized data

        // Reset preset ke 'Custom' setiap kali gambar baru diunggah
        presetSelect.value = "";
        widthInput.value = "";
        heightInput.value = "";

        // Setelah file di-upload, langsung picu proses resize awal
        // ini akan menampilkan pratinjau awal gambar asli di container
        // atau menerapkan preset jika preset sudah dipilih
        if (uploadedFiles.length > 0) {
             // Jika ada preset yang terpilih, picu click pada resizeAllButton
             // agar preset langsung diterapkan. Jika tidak, resizeAllButton
             // akan tetap menampilkan ukuran asli.
            if (presetSelect.value !== "") {
                resizeAllButton.click(); 
            } else {
                // Tampilkan pratinjau gambar asli jika tidak ada preset yang aktif
                for (const file of uploadedFiles) {
                    try {
                        const img = await loadImage(file);
                        // Gunakan ukuran asli untuk pratinjau awal
                        await drawAndGetResizedImage(img, file.name, img.width, img.height, formatSelect.value);
                    } catch (error) {
                        console.error(`Error loading initial preview for ${file.name}:`, error);
                        const errorItem = document.createElement('div');
                        errorItem.textContent = `Error loading initial preview for ${file.name}`;
                        errorItem.style.color = 'red';
                        resizedImagesContainer.appendChild(errorItem);
                    }
                }
            }
        }
    }


    // --- FITUR 1: Upload Images (via input file) ---
    imageUpload.addEventListener('change', (event) => {
        processUploadedFiles(event.target.files);
    });

    // --- FITUR 1: Drag & Drop Images ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false);
    });

    dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        processUploadedFiles(files);
    }, false);


    // --- FITUR 2: Resize Semua Gambar Sesuai Kustomisasi ---
    resizeAllButton.addEventListener('click', async () => {
        if (uploadedFiles.length === 0) {
            alert('Please upload images first.');
            return;
        }

        resizedImagesContainer.innerHTML = '<h2>Resizing... Please wait...</h2>';
        resizedImagesData = []; // Clear previous data

        const currentFormat = formatSelect.value;
        let inputWidth = parseInt(widthInput.value);
        let inputHeight = parseInt(heightInput.value);

        for (const file of uploadedFiles) {
            try {
                const img = await loadImage(file); // Load image from file

                let finalWidth = inputWidth;
                let finalHeight = inputHeight;

                // Hitung dimensi akhir berdasarkan input atau proporsi asli
                if (isNaN(inputWidth) && isNaN(inputHeight)) {
                    finalWidth = img.width;
                    finalHeight = img.height;
                } else if (isNaN(inputWidth)) {
                    finalWidth = Math.round((img.width / img.height) * finalHeight); // Pembulatan
                } else if (isNaN(inputHeight)) {
                    finalHeight = Math.round((img.height / img.width) * finalWidth); // Pembulatan
                }

                // Panggil fungsi untuk menggambar, membuat pratinjau, dan menyimpan data
                const resized = await drawAndGetResizedImage(img, file.name, finalWidth, finalHeight, currentFormat);
                if (resized) { // Hanya tambahkan jika resize berhasil
                    resizedImagesData.push(resized);
                }

            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                const errorItem = document.createElement('div');
                errorItem.textContent = `Error processing ${file.name}`;
                errorItem.style.color = 'red';
                resizedImagesContainer.appendChild(errorItem);
            }
        }
        
        // Hapus heading "Resizing..." jika semua gambar berhasil di-resize
        const resizingHeading = resizedImagesContainer.querySelector('h2');
        if(resizingHeading) resizingHeading.remove();

        // Tampilkan pesan placeholder jika tidak ada gambar yang berhasil di-resize
        if (resizedImagesData.length === 0 && uploadedFiles.length > 0) {
            resizedImagesContainer.innerHTML = '<p class="placeholder-text">No images were successfully resized.</p>';
        } else if (uploadedFiles.length === 0) {
            resizedImagesContainer.innerHTML = '<p class="placeholder-text">Upload images to start resizing!</p>';
        }
    });


    // --- Presets ---
    presetSelect.addEventListener('change', () => {
        const selectedPreset = presetSelect.value;

        // Reset input dan format setiap kali preset berubah
        widthInput.value = "";
        heightInput.value = "";
        formatSelect.value = "image/png"; // Default to PNG

        if (selectedPreset === 'thumbnail') {
            widthInput.value = 80;
            heightInput.value = 80;
            formatSelect.value = "image/png";
        } else if (selectedPreset === 'graphicriver') {
            widthInput.value = 590;
            heightInput.value = ""; // Tinggi bebas, jadi biarkan kosong
            formatSelect.value = "image/jpeg";
        }
        
        // Langsung trigger resize jika ada gambar yang diunggah
        if (uploadedFiles.length > 0) {
            resizeAllButton.click();
        }
    });


    // --- FITUR 3 & 4: Simpan ke Folder Lokal & Pilihan Format Simpan (Bulk Download) ---
    downloadAllButton.addEventListener('click', () => {
        if (resizedImagesData.length === 0) {
            alert('No resized images to download. Please upload and resize images first.');
            return;
        }

        const selectedFormat = formatSelect.value;

        let filesDownloaded = 0;
        resizedImagesData.forEach((imageData, index) => {
            const originalFileName = imageData.fileName;
            const baseFileName = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || `resized_image_${index + 1}`;
            let fileExtension;

            switch (selectedFormat) {
                case 'image/png':
                    fileExtension = 'png';
                    break;
                case 'image/jpeg':
                    fileExtension = 'jpeg';
                    break;
                case 'image/webp':
                    fileExtension = 'webp';
                    break;
                default:
                    fileExtension = 'png';
            }
            
            const finalFileName = `${baseFileName}.${fileExtension}`;

            const a = document.createElement('a');
            a.href = imageData.dataURL; 
            a.download = finalFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            filesDownloaded++;

            // Karena browser modern memblokir banyak download sekaligus, 
            // menunda sedikit antara setiap download mungkin membantu.
            // Namun, ini tidak selalu diperlukan dan bisa mempengaruhi UX.
            // Biarkan browser yang menangani antrean download-nya.
        });
        alert(`Successfully initiated download for ${filesDownloaded} image(s). Check your browser's download folder.`);
    });

    // Update preview jika format simpan diubah (untuk mengisi background putih pada JPEG)
    // Ini akan memicu resize ulang semua gambar
    formatSelect.addEventListener('change', () => {
        if (uploadedFiles.length > 0) {
            resizeAllButton.click(); // Re-resize all images with new format
        }
    });

    // Inisialisasi awal tampilan
    resizedImagesContainer.innerHTML = '<p class="placeholder-text">Upload images to start resizing!</p>';
});