import './style.css';
import { initConverter } from './converter.js';
import { renderGlobalMetrics } from './ui.js';

const SESSION_KEY      = 'canvaToSalesforce_auth';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// Trial: 17/04/2026 12:00 PM Colombia (UTC-5) + 72h
const TRIAL_START    = new Date('2026-04-17T12:00:00-05:00').getTime();
const TRIAL_DURATION = 72 * 60 * 60 * 1000;

document.addEventListener('DOMContentLoaded', () => {
  const viewLogin     = document.getElementById('view-login');
  const viewApp       = document.getElementById('view-app');
  const loginForm     = document.getElementById('login-form');
  const passwordInput = document.getElementById('password');
  const loginError    = document.getElementById('login-error');

  startTrialCountdown();

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

function startTrialCountdown() {
  const el = document.getElementById('trial-countdown');
  if (!el) return;

  const render = () => {
    const remaining = TRIAL_START + TRIAL_DURATION - Date.now();

    if (remaining <= 0) {
      el.textContent = 'Expirada';
      el.style.color = '#f87171';
      return true;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    el.textContent = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    el.style.color = remaining < 6 * 60 * 60 * 1000 ? '#fbbf24' : '#34d399';
    return false;
  };

  if (render()) return;
  const id = setInterval(() => { if (render()) clearInterval(id); }, 1000);
}
