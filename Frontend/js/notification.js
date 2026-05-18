// ============================================
// Toast Notification System
// ============================================

function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.error('Toast container not found');
        return;
    }

    // Icon mapping
    const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error:   '<i class="fas fa-exclamation-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        info:    '<i class="fas fa-info-circle"></i>'
    };

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Close">&times;</button>
    `;

    // Add to container
    container.appendChild(toast);

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });

    // Auto-remove after duration
    const timeoutId = setTimeout(() => {
        removeToast(toast);
    }, duration);

    // Return object for manual control
    return {
        element: toast,
        remove: () => {
            clearTimeout(timeoutId);
            removeToast(toast);
        }
    };
}

function removeToast(toast) {
    toast.classList.add('hide');
    setTimeout(() => {
        toast.remove();
    }, 300);
}

// Convenience functions
function showSuccess(message, duration = 4000) {
    return showToast(message, 'success', duration);
}

function showError(message, duration = 4000) {
    return showToast(message, 'error', duration);
}

function showWarning(message, duration = 4000) {
    return showToast(message, 'warning', duration);
}

function showInfo(message, duration = 4000) {
    return showToast(message, 'info', duration);
}