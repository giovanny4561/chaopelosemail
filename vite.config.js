import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    // Proxy /api requests to Vercel's local dev server if we ever ran 'vercel dev'
    // Alternatively, just proxy it to a custom express server if we had one.
    // For Vercel, running `vite dev` doesn't automatically execute Node serverless functions.
    // We need to use Vercel Dev (`vercel dev`) to test serverless functions locally.
    server: {
        port: 5173,
        // Add proxy if needed when not using Vercel CLI locally
    }
});
