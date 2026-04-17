import { getGlobalMetrics } from './db.js';

export function showState(stateId) {
    const dropZone = document.getElementById('drop-zone');
    const processingView = document.getElementById('processing-view');
    const successView = document.getElementById('success-view');

    dropZone.classList.add('hidden');
    processingView.classList.add('hidden');
    successView.classList.add('hidden');

    if (stateId === 'upload') {
        dropZone.classList.remove('hidden');
    } else if (stateId === 'processing') {
        processingView.classList.remove('hidden');
    } else if (stateId === 'success') {
        successView.classList.remove('hidden');
    }
}

export async function renderGlobalMetrics() {
    const kpiDashboard = document.getElementById('kpi-dashboard');
    const kpiUses = document.getElementById('kpi-uses');
    const kpiImages = document.getElementById('kpi-images');
    const kpiTime = document.getElementById('kpi-time');

    // Fallbacks while loading
    kpiUses.textContent = '...';
    kpiImages.textContent = '...';
    kpiTime.textContent = '...';
    kpiDashboard.style.opacity = '1';

    const metrics = await getGlobalMetrics();

    kpiUses.textContent = metrics?.uses ?? '0';
    kpiImages.textContent = metrics?.images ?? '0';
    const mins = Number(metrics?.minutes);
    kpiTime.textContent = isNaN(mins) ? '0' : (mins / 60).toFixed(1);
}

// UI Feedback
export function showError(message) {
    alert(message);
}

// Progress Steps
export function updateProgress(percent, statusText) {
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-status');
    const percentText = document.getElementById('progress-percentage');

    bar.style.width = `${percent}%`;
    if (statusText) text.textContent = statusText;
    percentText.textContent = `${Math.round(percent)}%`;
}

export function setStepActive(stepId) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(stepId).classList.remove('pending');
    document.getElementById(stepId).classList.add('active');
}

export function setStepDone(stepId) {
    const step = document.getElementById(stepId);
    step.classList.remove('active', 'pending');
    step.classList.add('done');
}

export function updateImagesCount(count) {
    document.getElementById('images-count').textContent = count;
}

export function updateSuccessCount(count) {
    document.getElementById('success-count').textContent = count;
}
