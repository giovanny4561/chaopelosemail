import './style.css';
import { initConverter } from './converter.js';

const SESSION_KEY = 'canvaToSalesforce_auth';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

const TRIAL_KEY = 'canvaToSalesforce_trial';
const TRIAL_DURATION_DAYS = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

document.addEventListener('DOMContentLoaded', () => {
  const viewLogin = document.getElementById('view-login');
  const viewApp = document.getElementById('view-app');
  const loginForm = document.getElementById('login-form');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('login-error');

  // Trial DOM
  const welcomePopup = document.getElementById('trial-welcome-popup');
  const expiredPopup = document.getElementById('trial-expired-popup');
  const closeWelcomeBtn = document.getElementById('btn-close-welcome');
  const footerText = document.getElementById('trial-footer-text');

  closeWelcomeBtn?.addEventListener('click', () => {
    welcomePopup.classList.add('hidden');
    // Mute welcome for remainder of device usage
    localStorage.setItem('canva_welcome_shown', 'true');
  });

  function getTrialData() {
    const rawData = localStorage.getItem(TRIAL_KEY);
    if (!rawData) return null;
    return JSON.parse(rawData);
  }

  function handleTrialLogic() {
    let trialData = getTrialData();

    // If no trial data exists, this is their first successful login
    if (!trialData) {
      trialData = {
        startDate: Date.now()
      };
      localStorage.setItem(TRIAL_KEY, JSON.stringify(trialData));
    }

    const elapsedMs = Date.now() - trialData.startDate;
    const elapsedDays = Math.floor(elapsedMs / MS_PER_DAY);
    const daysLeft = Math.max(0, TRIAL_DURATION_DAYS - elapsedDays);

    if (daysLeft === 0) {
      // Trial expired
      expiredPopup.classList.remove('hidden');
      welcomePopup.classList.add('hidden');
      viewApp.classList.add('hidden'); // Ensure app is hidden behind the blur
      return false; // Blocks app
    } else {
      // Active trial
      footerText.textContent = `Quedan ${daysLeft} días de prueba gratuita.`;

      // Show welcome popup only once per browser session
      if (!sessionStorage.getItem('canva_welcome_shown')) {
        welcomePopup.classList.remove('hidden');
      }
      return true; // Allows app
    }
  }

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

    // Evaluate trial before showing app
    const isTrialActive = handleTrialLogic();
    if (!isTrialActive) return; // Blocked by expired trial

    viewApp.classList.remove('hidden');
    initConverter(); // Initialize converter logic only when authenticated
    fetchCloudinaryUsage();
  }

  async function fetchCloudinaryUsage() {
    const badge = document.getElementById('quota-badge');
    const textElement = document.getElementById('quota-text');

    badge.classList.remove('hidden');
    textElement.textContent = 'Cargando almacenamiento...';

    try {
      const response = await fetch('/api/usage');
      if (response.ok) {
        const data = await response.json();
        textElement.textContent = `Almacenamiento: ${data.usageGB} GB / ${data.limitGB} GB (${data.percentage}%)`;

        if (parseFloat(data.percentage) > 90) {
          textElement.style.color = '#ff5252';
        } else if (parseFloat(data.percentage) > 75) {
          textElement.style.color = '#fbbf24';
        } else {
          textElement.style.color = 'inherit';
        }
      } else {
        console.warn('Failed to fetch usage:', await response.text());
        textElement.textContent = 'Almacenamiento: Disp. (Vercel Req.)';
      }
    } catch (err) {
      console.error('Error fetching usage:', err);
      textElement.textContent = 'Almacenamiento: Disp. (Vercel Req.)';
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
