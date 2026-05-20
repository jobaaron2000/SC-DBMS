// ============================================
// js/api.js  — Shared API helper
// Include this script BEFORE any page-specific JS
// ============================================

const API_BASE = 'https://sc-dbms-backend.vercel.app/api';

// ---- Token helpers (UPDATED TO SESSION STORAGE FOR SECURITY) ----
function getToken() {
    return sessionStorage.getItem('token');
}

function saveToken(token) {
    sessionStorage.setItem('token', token);
}

function clearSession() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
}

function getCurrentUser() {
    return JSON.parse(sessionStorage.getItem('user') || 'null');
}

function saveCurrentUser(user) {
    sessionStorage.setItem('user', JSON.stringify(user));
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