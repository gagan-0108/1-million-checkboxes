/**
 * Main Application Module
 * Orchestrates auth state, grid initialization, and socket connections.
 */

import { initGrid, updateCheckbox, setReadOnly, refreshGrid } from './grid.js';
import { initSocket, emitToggle, requestStats, reconnectWithAuth } from './socket.js';

// ─── State ───
let currentUser = null;
let onlineUsers = 0;
let totalChecked = 0;
let isAuthenticated = false;

// ─── DOM References ───
const DOM = {};

/**
 * Initialize the application.
 */
async function init() {
  cacheDOMReferences();
  await checkAuthStatus();
  initializeSocket();
  initializeGrid();
  setupEventListeners();
  startStatsPolling();
}

/**
 * Cache frequently accessed DOM elements.
 */
function cacheDOMReferences() {
  DOM.authSection = document.getElementById('auth-section');
  DOM.loginBtn = document.getElementById('login-btn');
  DOM.logoutBtn = document.getElementById('logout-btn');
  DOM.userInfo = document.getElementById('user-info');
  DOM.userName = document.getElementById('user-name');
  DOM.userAvatar = document.getElementById('user-avatar');
  DOM.loginOverlay = document.getElementById('login-overlay');
  DOM.loginDismiss = document.getElementById('login-dismiss');
  DOM.gridViewport = document.getElementById('grid-viewport');
  DOM.gridSpacer = document.getElementById('grid-spacer');
  DOM.gridContent = document.getElementById('grid-content');
  DOM.loadingState = document.getElementById('loading-state');
  DOM.statChecked = document.getElementById('stat-checked');
  DOM.statOnline = document.getElementById('stat-online');
  DOM.statPercent = document.getElementById('stat-percent');
  DOM.progressFill = document.getElementById('progress-fill');
  DOM.toastContainer = document.getElementById('toast-container');
  DOM.connectionDot = document.getElementById('connection-dot');
}

/**
 * Check if the user is already authenticated (via cookie).
 */
async function checkAuthStatus() {
  try {
    const res = await fetch('/auth/me');
    const data = await res.json();

    if (data.authenticated && data.user) {
      currentUser = data.user;
      isAuthenticated = true;
      updateAuthUI(true);
      setReadOnly(false);
    } else {
      updateAuthUI(false);
      setReadOnly(true);
      // Show login overlay after a short delay
      setTimeout(() => {
        DOM.loginOverlay?.classList.add('visible');
      }, 1500);
    }
  } catch (err) {
    console.error('[App] Auth check failed:', err);
    updateAuthUI(false);
    setReadOnly(true);
  }
}

/**
 * Update the UI based on auth state.
 */
function updateAuthUI(loggedIn) {
  if (loggedIn && currentUser) {
    DOM.loginBtn.style.display = 'none';
    DOM.userInfo.style.display = 'flex';
    DOM.logoutBtn.style.display = 'inline-flex';
    DOM.userName.textContent = currentUser.name;
    DOM.userAvatar.src = currentUser.picture || '';
    DOM.loginOverlay?.classList.remove('visible');
  } else {
    DOM.loginBtn.style.display = 'inline-flex';
    DOM.userInfo.style.display = 'none';
    DOM.logoutBtn.style.display = 'none';
  }
}

/**
 * Initialize the Socket.io connection.
 */
function initializeSocket() {
  initSocket({
    onUpdate: (data) => {
      updateCheckbox(data.index, data.checked);
    },
    onError: (data) => {
      showToast(data.error || 'An error occurred', 'error');
    },
    onStats: (data) => {
      updateStats(data);
    },
    onUsers: (data) => {
      onlineUsers = data.count;
      updateStatsDisplay();
    },
    onConnect: () => {
      DOM.connectionDot?.classList.add('online');
      showToast('Connected to server', 'success', 2000);
    },
    onDisconnect: () => {
      DOM.connectionDot?.classList.remove('online');
      showToast('Disconnected from server', 'error');
    },
  });
}

/**
 * Initialize the virtual-scroll checkbox grid.
 */
function initializeGrid() {
  // Hide loading state once grid is ready
  if (DOM.loadingState) {
    DOM.loadingState.style.display = 'none';
  }

  initGrid(
    DOM.gridViewport,
    DOM.gridSpacer,
    DOM.gridContent,
    (index, checked) => {
      emitToggle(index, checked);
    }
  );
}

/**
 * Set up UI event listeners.
 */
function setupEventListeners() {
  // Login button
  DOM.loginBtn?.addEventListener('click', () => {
    window.location.href = '/auth/google';
  });

  // Logout button
  DOM.logoutBtn?.addEventListener('click', async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
      currentUser = null;
      isAuthenticated = false;
      updateAuthUI(false);
      setReadOnly(true);
      refreshGrid();
      showToast('Logged out successfully', 'info');
    } catch (err) {
      showToast('Logout failed', 'error');
    }
  });

  // Login overlay dismiss
  DOM.loginDismiss?.addEventListener('click', () => {
    DOM.loginOverlay?.classList.remove('visible');
  });

  // Login overlay button
  document.getElementById('login-overlay-btn')?.addEventListener('click', () => {
    window.location.href = '/auth/google';
  });
}

/**
 * Update stats from server data.
 */
function updateStats(data) {
  totalChecked = data.totalChecked || 0;
  if (data.onlineUsers !== undefined) {
    onlineUsers = data.onlineUsers;
  }
  updateStatsDisplay();
}

/**
 * Update the stats display in the header.
 */
function updateStatsDisplay() {
  const total = 1_000_000;
  const percent = ((totalChecked / total) * 100).toFixed(2);

  if (DOM.statChecked) {
    DOM.statChecked.textContent = totalChecked.toLocaleString();
  }
  if (DOM.statOnline) {
    DOM.statOnline.textContent = onlineUsers.toLocaleString();
  }
  if (DOM.statPercent) {
    DOM.statPercent.textContent = `${percent}%`;
  }
  if (DOM.progressFill) {
    DOM.progressFill.style.width = `${percent}%`;
  }
}

/**
 * Poll stats every 5 seconds.
 */
function startStatsPolling() {
  setInterval(() => {
    requestStats();
  }, 5000);
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {string} type - 'error' | 'info' | 'success'
 * @param {number} duration - Auto-dismiss time in ms (default: 4000)
 */
function showToast(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close">&times;</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });

  DOM.toastContainer?.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(120%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Boot ───
document.addEventListener('DOMContentLoaded', init);
