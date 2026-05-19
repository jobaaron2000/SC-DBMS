// ============================================
// js/api.js  — Shared API helper
// Include this script BEFORE any page-specific JS
// ============================================

const API_BASE = 'https://sc-dbms-backend.vercel.app';  // Change to your server URL in production

// ---- Token helpers ----
function getToken() {
    return localStorage.getItem('scms_token');
}
function saveToken(token) {
    localStorage.setItem('scms_token', token);
}
function clearSession() {
    localStorage.removeItem('scms_token');
    localStorage.removeItem('scms_user');
}
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('scms_user') || 'null');
}
function saveCurrentUser(user) {
    localStorage.setItem('scms_user', JSON.stringify(user));
}

/**
 * Main fetch wrapper — automatically attaches Authorization header.
 * @param {string} endpoint  e.g. '/seniors'
 * @param {object} options   fetch options (method, body, etc.)
 * @returns {Promise<object>} parsed JSON response
 */
async function apiFetch(endpoint, options = {}) {
    const token = getToken();

    const headers = {
        ...(options.headers || {}),
    };

    // Only set Content-Type to JSON if we're NOT sending FormData
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json();

    // If token expired or invalid, kick to login
    if (response.status === 401 || response.status === 403) {
        if (data.message && data.message.toLowerCase().includes('token')) {
            clearSession();
            window.location.href = 'login.html';
            return;
        }
    }

    return { ok: response.ok, status: response.status, ...data };
}
