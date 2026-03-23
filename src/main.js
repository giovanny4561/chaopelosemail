import './style.css';
import { initConverter } from './converter.js';
import { renderGlobalMetrics } from './ui.js';

const SESSION_KEY = 'canvaToSalesforce_auth';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

document.addEventListener('DOMContentLoaded', () => {
  const viewLogin = document.getElementById('view-login');
  const viewApp = document.getElementById('view-app');
  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('login-error');

  // Migration notice popup (once per day)
  const migrationPopup = document.getElementById('migration-notice-popup');
  const closeMigrationBtn = document.getElementById('btn-close-migration');

  function showMigrationPopupIfNeeded() {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const lastShown = localStorage.getItem('migration_notice_date');
    if (lastShown !== today) {
      migrationPopup.classList.remove('hidden');
    }
  }

  closeMigrationBtn?.addEventListener('click', () => {
    migrationPopup.classList.add('hidden');
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('migration_notice_date', today);
  });

  function checkSession() {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      const parsedSession = JSON.parse(savedSession);
      const now = Date.now();
      if (now - parsedSession.timestamp < SESSION_DURATION_MS && parsedSession.authenticated === true) {
        return true;
      } else {
        // Session expired
        localStorage.removeItem(SESSION_KEY);
        return false;
      }
    }
    return false;
  }

  function showApp() {
    viewLogin.classList.add('hidden');
    viewApp.classList.remove('hidden');
    initConverter(); // Initialize converter logic only when authenticated
    fetchCloudinaryUsage();
    renderGlobalMetrics();
    showMigrationPopupIfNeeded();
  }

  async function fetchCloudinaryUsage() {
    const badge = document.getElementById('quota-badge');
    const textElement = document.getElementById('quota-text');

    badge.classList.remove('hidden');
    textElement.textContent = 'Cargando...';

    try {
      const response = await fetch('/api/usage');
      if (response.ok) {
        const data = await response.json();
        textElement.textContent = `${data.usageGB} GB / ${data.limitGB} GB (${data.percentage}%)`;

        if (parseFloat(data.percentage) > 90) {
          textElement.style.color = '#ff5252';
        } else if (parseFloat(data.percentage) > 75) {
          textElement.style.color = '#fbbf24';
        } else {
          textElement.style.color = 'inherit';
        }
      } else {
        console.warn('Failed to fetch usage:', await response.text());
        textElement.textContent = 'Disp. (Vercel Req.)';
      }
    } catch (err) {
      console.error('Error fetching usage:', err);
      textElement.textContent = 'Disp. (Vercel Req.)';
    }
  }

  window.fetchCloudinaryUsage = fetchCloudinaryUsage;

  function showLogin() {
    viewLogin.classList.remove('hidden');
    viewApp.classList.add('hidden');
  }

  // On Load
  const currentRole = checkSession();
  if (currentRole) {
    showApp(currentRole);
  } else {
    showLogin();
  }

  // Handle Login Submit
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pwd = passwordInput.value;

    if (pwd === '777' || pwd === '6004') {
      const role = pwd === '6004' ? 'admin' : 'user';

      // Save successful session timestamp
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        authenticated: true,
        timestamp: Date.now(),
        role: role
      }));

      loginError.classList.add('hidden');
      showApp(role);
    } else {
      // Wrong password
      loginError.classList.remove('hidden');
      passwordInput.value = '';
      passwordInput.focus();
    }
  });

});
