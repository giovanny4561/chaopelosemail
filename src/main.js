import './style.css';
import { initConverter } from './converter.js';
import { renderGlobalMetrics } from './ui.js';

const SESSION_KEY = 'canvaToSalesforce_auth';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

// ─── SYSTEM LOCK ────────────────────────────────────────────────────────────
// Set to false to re-enable the system
const SYSTEM_DISABLED = true;
// ────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const viewLogin = document.getElementById('view-login');
  const viewApp = document.getElementById('view-app');
  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('btn-login');
  const lockPopup = document.getElementById('migration-notice-popup');

  // ── Lock enforcement ──────────────────────────────────────────────────────
  function enforceLock() {
    if (!SYSTEM_DISABLED) return;

    // Clear any saved session so re-enabling requires fresh login
    localStorage.removeItem(SESSION_KEY);

    // If popup was removed from DOM (DevTools), replace entire body content
    if (!document.getElementById('migration-notice-popup')) {
      document.body.innerHTML =
        '<div style="position:fixed;inset:0;background:#0f172a;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;color:#f87171;font-family:sans-serif;text-align:center;padding:2rem;">' +
        '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" style="margin-bottom:1rem">' +
        '<rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#f87171" stroke-width="2"/>' +
        '<path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#f87171" stroke-width="2"/></svg>' +
        '<h2 style="font-size:1.5rem;margin-bottom:0.75rem">Sistema Desactivado</h2>' +
        '<p style="color:#94a3b8;margin-bottom:0.5rem">giovannymarin23@gmail.com</p>' +
        '<p style="color:#94a3b8">WhatsApp: +573006795375</p></div>';
      return;
    }

    // Ensure popup is always fully visible and on top
    lockPopup.style.cssText =
      'position:fixed!important;inset:0!important;background:rgba(10,10,20,0.55)!important;' +
      'z-index:2147483647!important;display:flex!important;align-items:center!important;' +
      'justify-content:center!important;backdrop-filter:blur(3px) brightness(0.6)!important;' +
      'visibility:visible!important;opacity:1!important;pointer-events:all!important;';

    // Block underlying app interaction
    const app = document.getElementById('app');
    if (app) {
      app.style.pointerEvents = 'none';
      app.style.userSelect = 'none';
    }

    // Keep login button disabled
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.style.opacity = '0.4';
      loginBtn.style.cursor = 'not-allowed';
    }
  }

  if (SYSTEM_DISABLED) {
    // Initial enforcement
    enforceLock();

    // Load metrics into popup cards
    loadLockMetrics();

    // Watch for DOM mutations (DevTools node removal / style changes)
    const observer = new MutationObserver(() => enforceLock());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // Belt-and-suspenders: periodic re-check every 500ms
    setInterval(enforceLock, 500);

    // Stop here — don't run rest of login/app logic
    return;
  }
  // ── End lock ──────────────────────────────────────────────────────────────

  function checkSession() {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      const parsedSession = JSON.parse(savedSession);
      const now = Date.now();
      if (now - parsedSession.timestamp < SESSION_DURATION_MS && parsedSession.authenticated === true) {
        return true;
      } else {
        localStorage.removeItem(SESSION_KEY);
        return false;
      }
    }
    return false;
  }

  function showApp() {
    if (SYSTEM_DISABLED) return;
    viewLogin.classList.add('hidden');
    viewApp.classList.remove('hidden');
    initConverter();
    fetchCloudinaryUsage();
    renderGlobalMetrics();
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
    showApp();
  } else {
    showLogin();
  }

  // Handle Login Submit
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (SYSTEM_DISABLED) {
      loginError.classList.remove('hidden');
      loginError.textContent = 'Sistema desactivado. Contacte al administrador.';
      passwordInput.value = '';
      return;
    }
    const pwd = passwordInput.value;
    if (pwd === '777') {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        authenticated: true,
        timestamp: Date.now()
      }));
      loginError.classList.add('hidden');
      showApp();
    } else {
      loginError.classList.remove('hidden');
      passwordInput.value = '';
      passwordInput.focus();
    }
  });

});

// Fetch real metrics from Supabase for the lock popup
async function loadLockMetrics() {
  try {
    const { supabase } = await import('./db.js');
    const { data } = await supabase.rpc('get_total_metrics');
    if (data) {
      setLockKpi(data.total_conversions ?? 28, data.total_images ?? 236, data.total_minutes_saved ?? 944);
      return;
    }
  } catch (_) {
    // ignore — use hardcoded fallback
  }
  setLockKpi(28, 236, 944);
}

function setLockKpi(uses, images, minutes) {
  const u = document.getElementById('lock-kpi-uses');
  const i = document.getElementById('lock-kpi-images');
  const t = document.getElementById('lock-kpi-time');
  if (u) u.textContent = uses;
  if (i) i.textContent = images;
  if (t) t.textContent = minutes;
}
