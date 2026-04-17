import './style.css';
import { initConverter } from './converter.js';
import { renderGlobalMetrics } from './ui.js';

const SESSION_KEY       = 'canvaToSalesforce_auth';
const SESSION_DURATION  = 7 * 24 * 60 * 60 * 1000;  // 7 days
const TRIAL_DURATION    = 72 * 60 * 60 * 1000;       // 72 hours
const PASSWORD          = '777';

document.addEventListener('DOMContentLoaded', () => {
  const viewLogin     = document.getElementById('view-login');
  const viewApp       = document.getElementById('view-app');
  const loginForm     = document.getElementById('login-form');
  const passwordInput = document.getElementById('password');
  const loginError    = document.getElementById('login-error');
  const loginBtn      = document.getElementById('btn-login');

  // ── Session helpers ──────────────────────────────────────────────────────

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function trialExpired(trialStartedAt) {
    return Date.now() - trialStartedAt >= TRIAL_DURATION;
  }

  function sessionValid(s) {
    if (!s?.authenticated) return false;
    if (Date.now() - s.timestamp >= SESSION_DURATION) return false;
    if (trialExpired(s.trialStartedAt)) return false;
    return true;
  }

  // ── UI helpers ───────────────────────────────────────────────────────────

  function showApp() {
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

  function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.remove('hidden');
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

  // ── Init ─────────────────────────────────────────────────────────────────

  const session = getSession();

  if (session && trialExpired(session.trialStartedAt)) {
    localStorage.removeItem(SESSION_KEY);
    showLogin();
    showError('Tu período de prueba de 72 horas ha expirado. Contacta al administrador para continuar.');
  } else if (sessionValid(session)) {
    showApp();
  } else {
    if (session) localStorage.removeItem(SESSION_KEY);
    showLogin();
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    if (passwordInput.value !== PASSWORD) {
      showError('Contraseña incorrecta.');
      passwordInput.value = '';
      passwordInput.focus();
      return;
    }

    // First time logging in: record trial start; otherwise keep existing start
    const existing = getSession();
    const trialStartedAt = existing?.trialStartedAt ?? Date.now();

    if (trialExpired(trialStartedAt)) {
      showError('Tu período de prueba de 72 horas ha expirado. Contacta al administrador para continuar.');
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify({
      authenticated: true,
      trialStartedAt,
      timestamp: Date.now(),
    }));

    showApp();
  });

  // ── Logout (optional, exposed globally for a logout button) ───────────────

  window.logout = () => {
    localStorage.removeItem(SESSION_KEY);
    showLogin();
    loginError.classList.add('hidden');
    passwordInput.value = '';
  };
});
