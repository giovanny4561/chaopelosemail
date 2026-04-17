import './style.css';
import { initConverter } from './converter.js';
import { renderGlobalMetrics } from './ui.js';

const SESSION_KEY      = 'canvaToSalesforce_auth';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── SYSTEM LOCK ────────────────────────────────────────────────────────────
// Set to false to re-enable the system
const SYSTEM_DISABLED = true;
let cachedPopupHTML = null;
// ────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const viewLogin     = document.getElementById('view-login');
  const viewApp       = document.getElementById('view-app');
  const loginForm     = document.getElementById('login-form');
  const passwordInput = document.getElementById('password');
  const loginError    = document.getElementById('login-error');
  const loginBtn      = document.getElementById('btn-login');
  const lockPopup     = document.getElementById('migration-notice-popup');

  // ── Lock enforcement ──────────────────────────────────────────────────────
  function enforceLock() {
    if (!SYSTEM_DISABLED) return;

    localStorage.removeItem(SESSION_KEY);

    const existingPopup = document.getElementById('migration-notice-popup');

    if (existingPopup && !cachedPopupHTML) {
      cachedPopupHTML = existingPopup.outerHTML;
    }

    if (!existingPopup) {
      if (cachedPopupHTML) {
        document.body.insertAdjacentHTML('beforeend', cachedPopupHTML);
      }
      return;
    }

    existingPopup.style.cssText =
      'position:fixed!important;inset:0!important;background:rgba(10,10,20,0.55)!important;' +
      'z-index:2147483647!important;display:flex!important;align-items:center!important;' +
      'justify-content:center!important;backdrop-filter:blur(3px) brightness(0.6)!important;' +
      'visibility:visible!important;opacity:1!important;pointer-events:all!important;';

    const app = document.getElementById('app');
    if (app) {
      app.style.pointerEvents = 'none';
      app.style.userSelect = 'none';
    }

    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.style.opacity = '0.4';
      loginBtn.style.cursor = 'not-allowed';
    }
  }

  if (SYSTEM_DISABLED) {
    enforceLock();
    loadLockMetrics();

    const observer = new MutationObserver(() => enforceLock());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'disabled']
    });

    setInterval(enforceLock, 500);
    return;
  }
  // ── End lock ──────────────────────────────────────────────────────────────

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function sessionValid(s) {
    if (!s?.authenticated) return false;
    if (Date.now() - s.timestamp >= SESSION_DURATION) return false;
    return true;
  }

  function showApp() {
    if (SYSTEM_DISABLED) return;
    viewLogin.classList.add('hidden');
    viewApp.classList.remove('hidden');
    initConverter();
    fetchCloudinaryUsage();
    renderGlobalMetrics();
  }

  function showLogin() {
    viewLogin.classList.remove('hidden');
    viewApp.classList.add('hidden');
  }

  async function fetchCloudinaryUsage() {
    const badge = document.getElementById('quota-badge');
    const text  = document.getElementById('quota-text');
    badge.classList.remove('hidden');
    text.textContent = 'Cargando...';
    try {
      const res = await fetch('/api/usage');
      if (res.ok) {
        const d = await res.json();
        text.textContent = `${d.usageGB} GB / ${d.limitGB} GB (${d.percentage}%)`;
        text.style.color =
          parseFloat(d.percentage) > 90 ? '#ff5252' :
          parseFloat(d.percentage) > 75 ? '#fbbf24' : 'inherit';
      } else {
        text.textContent = 'Disp. (Vercel Req.)';
      }
    } catch {
      text.textContent = 'Disp. (Vercel Req.)';
    }
  }

  window.fetchCloudinaryUsage = fetchCloudinaryUsage;

  window.logout = () => {
    localStorage.removeItem(SESSION_KEY);
    showLogin();
    loginError.classList.add('hidden');
    passwordInput.value = '';
  };

  const session = getSession();
  if (sessionValid(session)) {
    showApp();
  } else {
    if (session) localStorage.removeItem(SESSION_KEY);
    showLogin();
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (SYSTEM_DISABLED) return;
    loginError.classList.add('hidden');

    if (passwordInput.value !== '777') {
      loginError.textContent = 'Contraseña incorrecta.';
      loginError.classList.remove('hidden');
      passwordInput.value = '';
      passwordInput.focus();
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify({
      authenticated: true,
      timestamp: Date.now(),
    }));
    showApp();
  });
});

// Fetch real metrics from Supabase for the lock popup
async function loadLockMetrics() {
  try {
    const { getGlobalMetrics } = await import('./db.js');
    const metrics = await getGlobalMetrics();
    if (metrics && metrics.uses !== '--') {
      const u = document.getElementById('lock-kpi-uses');
      const i = document.getElementById('lock-kpi-images');
      const t = document.getElementById('lock-kpi-time');
      if (u) u.textContent = metrics.uses;
      if (i) i.textContent = metrics.images;
      if (t) t.textContent = metrics.minutes;
    }
  } catch (_) {
    // HTML already shows hardcoded fallback values (28 / 236 / 944)
  }
}
