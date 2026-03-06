const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
        console.log('Navegando a la app local...');
        await page.goto('http://127.0.0.1:8080/');

        // Fill credentials
        console.log('Llenando datos de Cloudinary (dummy)...');
        await page.fill('#cloud-name', 'test_cloud');
        await page.fill('#upload-preset', 'test_preset');

        // Set file to input
        console.log('Subiendo el archivo ZIP de Canva...');
        const fileInput = await page.$('#file-input');
        await fileInput.setInputFiles('C:\\Users\\giova\\Documents\\.chaopeloswmail\\Mail Día de la mujer (1).zip');

        // Wait for processing state to appear
        await page.waitForSelector('#processing-view:not(.hidden)');
        console.log('Vista de procesamiento visible.');

        // Wait for JSZip to extract and count images
        await page.waitForTimeout(1000);
        const stepExtract = await page.$eval('#step-extract', el => el.className);
        console.log('Estado del paso 1 (Extraer):', stepExtract);

        const count = await page.$eval('#images-count', el => el.textContent);
        console.log(`Imágenes encontradas en el ZIP: ${count}`);

        // Since we used dummy credentials, it should fail at the upload step
        // We wait for the alert dialog
        page.on('dialog', async dialog => {
            console.log('ALERTA recibida:', dialog.message());
            await dialog.accept();
        });

        // Wait a bit to let it try uploading
        await page.waitForTimeout(3000);

    } catch (error) {
        console.error('Error durante el test:', error);
    } finally {
        await browser.close();
        console.log('Test finalizado.');
    }
})();
