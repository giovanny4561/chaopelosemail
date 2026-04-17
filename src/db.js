import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://liqmzvhyepqapgzycdfg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcW16dmh5ZXBxYXBnenljZGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjA5MjQsImV4cCI6MjA4NzYzNjkyNH0.uxS9xAkNtB0UoXGOxvR4plI6TEXZa4KQE7F9T5I038E';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Log metrics after a successful conversion
export async function logConversionMetrics(imagesCount) {
    if (imagesCount === 0) return;

    // 4 minutes saved per image
    const minutesSaved = imagesCount * 4;

    try {
        const { error } = await supabase
            .from('conversion_metrics')
            .insert([
                { images_processed: imagesCount, minutes_saved: minutesSaved }
            ]);

        if (error) throw error;
    } catch (err) {
        console.error('Error logging metrics to Supabase:', err);
    }
}

// Fetch aggregate statistics to display on the success screen
export async function getGlobalMetrics() {
    // Try RPC first
    try {
        const { data, error } = await supabase.rpc('get_total_metrics');
        if (!error && data && data.length > 0) {
            return {
                uses: Number(data[0].total_conversions) || 0,
                images: Number(data[0].total_images) || 0,
                minutes: Number(data[0].total_minutes) || 0
            };
        }
        if (error) throw error;
    } catch (err) {
        console.error('get_total_metrics RPC failed, trying direct query:', err);
    }

    // Fallback: direct table query (works even if RPC doesn't exist yet)
    try {
        const { data: rows, error } = await supabase
            .from('conversion_metrics')
            .select('images_processed, minutes_saved');
        if (!error && rows) {
            return {
                uses: rows.length,
                images: rows.reduce((s, r) => s + (Number(r.images_processed) || 0), 0),
                minutes: rows.reduce((s, r) => s + (Number(r.minutes_saved) || 0), 0)
            };
        }
    } catch (err) {
        console.error('Direct table query also failed:', err);
    }

    return { uses: 0, images: 0, minutes: 0 };
}
