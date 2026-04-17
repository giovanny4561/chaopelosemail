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
    try {
        const { data, error } = await supabase.rpc('get_total_metrics');
        if (error) throw error;

        if (data && data.length > 0) {
            return {
                uses: data[0].total_conversions || 0,
                images: data[0].total_images || 0,
                minutes: data[0].total_minutes || 0
            };
        }
    } catch (err) {
        console.error('Error fetching global metrics:', err);
    }

    return { uses: '--', images: '--', minutes: '--' };
}
