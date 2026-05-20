// ============================================
// js/api.js  — Shared API helper
// Include this script BEFORE any page-specific JS
// ============================================

const API_BASE = 'https://sc-dbms-backend.vercel.app/api';

// ---- Token helpers ----
// FIXED: Changed 'scms_token' to 'token' to match your registration/login scripts!
function getToken() {
    return localStorage.getItem('token');
}
function saveToken(token) {
    localStorage.setItem('token', token);
}
function clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
}
function saveCurrentUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
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

    // FIXED: The parenthesis is now correctly at the very end of the fetch block!
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