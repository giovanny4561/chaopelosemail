import JSZip from 'jszip';
import {
    showState, showError, updateProgress,
    setStepActive, setStepDone, updateImagesCount,
    updateSuccessCount, renderGlobalMetrics
} from './ui.js';
import { logConversionMetrics } from './db.js';

export function initConverter() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const btnBrowse = document.getElementById('btn-browse');
    const btnReset = document.getElementById('btn-reset');
    const btnDownload = document.getElementById('btn-download');

    // Trigger file selection
    btnBrowse.addEventListener('click', () => {
        fileInput.click();
    });

    // Handle Drag & Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-active'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length) handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    btnReset.addEventListener('click', () => {
        showState('upload');
        fileInput.value = '';
        window.convertedHtmlBlob = null;

        // Reset steps
        ['step-extract', 'step-read-html', 'step-resize', 'step-format', 'step-upload', 'step-rewrite'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('active', 'done');
                el.classList.add('pending');
            }
        });
    });

    btnDownload.addEventListener('click', () => {
        if (window.convertedHtmlBlob) {
            const url = URL.createObjectURL(window.convertedHtmlBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'email_salesforce.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });

}

async function uploadToCloudinary(base64Data, cloudName, uploadPreset) {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', base64Data);
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Error al procesar la imagen en el servidor');
    }

    const data = await response.json();

    // Optimize delivery by applying auto-format and auto-quality
    const optimizedUrl = data.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
    return optimizedUrl;
}

async function handleFile(file) {
    if (!file.name.endsWith('.zip')) {
        alert('Por favor, sube un archivo ZIP (el export de Canva).');
        return;
    }

    // Hardcoded Cloudinary config for 1-click experience
    const cloudName = 'di1dvgllh';
    const uploadPreset = 'canva_email';

    try {
        showState('processing');
        updateProgress(5, 'Iniciando...');
        setStepActive('step-extract');

        // 1. Read ZIP
        updateProgress(10, 'Leyendo archivo ZIP...');
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);

        // 2. Find HTML and Images
        let htmlContent = null;
        const imagesToUpload = [];

        // Map through ZIP contents
        for (const [path, zipEntry] of Object.entries(contents.files)) {
            if (zipEntry.dir) continue;

            if (path.endsWith('.html')) {
                htmlContent = await zipEntry.async('string');
            } else if (path.includes('images/') && (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.gif'))) {
                const base64 = await zipEntry.async('base64');
                const filename = path.split('/').pop();
                imagesToUpload.push({
                    filename,
                    // Cloudinary accepts base64 data URIs for unsigned uploads
                    data: `data:image/${path.endsWith('.jpg') || path.endsWith('.jpeg') ? 'jpeg' : 'png'};base64,${base64}`
                });
            }
        }

        if (!htmlContent) {
            throw new Error('No se encontró ningún archivo HTML dentro del ZIP. Asegúrate de exportar correctamente desde Canva.');
        }

        updateImagesCount(imagesToUpload.length);
        updateProgress(30, 'ZIP extraído, analizando código...');
        setStepDone('step-extract');

        // Step 2: Read HTML
        setStepActive('step-read-html');
        await new Promise(resolve => setTimeout(resolve, 600));
        setStepDone('step-read-html');

        // Step 3: Resize images (simulated perception for local processing)
        setStepActive('step-resize');
        updateProgress(35, 'Comprimiendo capas...');
        await new Promise(resolve => setTimeout(resolve, 800));
        setStepDone('step-resize');

        // Step 4: Convert format (simulated perception before upload)
        setStepActive('step-format');
        updateProgress(38, 'Adaptando formatos...');
        await new Promise(resolve => setTimeout(resolve, 700));
        setStepDone('step-format');

        // Step 5: Upload mapping
        setStepActive('step-upload');

        // 3. Upload images directly to Cloudinary
        let uploadedUrls = {}; // { "filename.png": "https://res.cloudinary..." }

        if (imagesToUpload.length > 0) {
            updateProgress(40, `Procesando ${imagesToUpload.length} imágenes...`);

            // Upload concurrently but track progress
            let completed = 0;

            const uploadPromises = imagesToUpload.map(async (img) => {
                const secureUrl = await uploadToCloudinary(img.data, cloudName, uploadPreset);
                uploadedUrls[img.filename] = secureUrl;

                // Update progress bar
                completed++;
                const currentProgress = 40 + (40 * (completed / imagesToUpload.length)); // Progress from 40% to 80%
                updateProgress(currentProgress, `Subiendo imagen ${completed} de ${imagesToUpload.length}...`);
            });

            await Promise.all(uploadPromises);
            updateProgress(80, 'Todas las imágenes subidas correctamente.');
        }

        setStepDone('step-upload');
        setStepActive('step-rewrite');
        updateProgress(85, 'Reescribiendo rutas relativas en el HTML...');

        // 4. Transform HTML: replace local image paths with Cloudinary URLs
        let newHtmlContent = htmlContent;

        Object.entries(uploadedUrls).forEach(([filename, url]) => {
            // Canva usually outputs paths like "images/hash.png" or just "images/hash.png"
            // We global replace any variation of the local path
            const regex1 = new RegExp(`images/${filename}`, 'g');
            const regex2 = new RegExp(`\.\/images/${filename}`, 'g');
            const regex3 = new RegExp(`"([^"]*)${filename}"`, 'g'); // Catch-all for "anything/hash.png" just in case

            newHtmlContent = newHtmlContent.replace(regex1, url);
            newHtmlContent = newHtmlContent.replace(regex2, url);
        });

        // Ensure a meta charset tag exists for platforms like Salesforce that might ignore the BOM
        if (!newHtmlContent.toLowerCase().includes('charset=utf-8') && !newHtmlContent.toLowerCase().includes('charset="utf-8"')) {
            newHtmlContent = newHtmlContent.replace('<head>', '<head>\n    <meta charset="utf-8">');
        }

        // Inject Salesforce Marketing Cloud open tracking tag before closing body
        if (!newHtmlContent.includes('<custom name="opencounter"')) {
            newHtmlContent = newHtmlContent.replace('</body>', '  <custom name="opencounter" type="tracking" />\n</body>');
        }

        updateProgress(95, 'Generando archivo final...');
        // Add UTF-8 BOM (\ufeff) to force browsers and Salesforce to read it correctly
        window.convertedHtmlBlob = new Blob(['\ufeff', newHtmlContent], { type: 'text/html;charset=utf-8' });

        setStepDone('step-rewrite');
        updateProgress(100, '¡Proceso finalizado!');

        // 5. Show Success Screen
        setTimeout(async () => {
            // Log to Supabase silently
            await logConversionMetrics(imagesToUpload.length);

            showState('success');
            updateSuccessCount(imagesToUpload.length);

            // Fetch latest global KPIs
            renderGlobalMetrics();

            // Try to update usage quota since we just uploaded images
            window.fetchCloudinaryUsage?.();
        }, 500);

    } catch (err) {
        console.error(err);
        alert(`Ocurrió un error: ${err.message}`);
        showState('upload');
    }
}
