export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'di1dvgllh';
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!apiKey || !apiSecret) {
            return response.status(500).json({ error: 'Missing Cloudinary API credentials in environment variables.' });
        }

        const url = `https://api.cloudinary.com/v1_1/${cloudName}/usage`;
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

        const cloudinaryResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });

        if (!cloudinaryResponse.ok) {
            const errorText = await cloudinaryResponse.text();
            throw new Error(`Cloudinary API Error: ${cloudinaryResponse.status} - ${errorText}`);
        }

        const data = await cloudinaryResponse.json();

        // The Cloudinary Usage API returns usage for "credits", "storage", etc.
        // We want the storage metrics: data.storage.usage (bytes) and data.storage.limit (bytes)
        const storageUsage = data.storage?.usage || 0;
        const storageLimit = data.storage?.limit || (25 * 1024 * 1024 * 1024); // Default to 25GB if not found

        const limitGB = (storageLimit / (1024 * 1024 * 1024)).toFixed(0);
        const usageGB = (storageUsage / (1024 * 1024 * 1024)).toFixed(2);
        const percentage = ((storageUsage / storageLimit) * 100).toFixed(1);

        return response.status(200).json({
            usageBytes: storageUsage,
            limitBytes: storageLimit,
            usageGB: usageGB,
            limitGB: limitGB,
            percentage: percentage
        });

    } catch (error) {
        console.error("Error fetching Cloudinary usage:", error);
        return response.status(500).json({ error: error.message });
    }
}
