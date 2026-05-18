// ============================================
// Landing Page - Admin PIN Login
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const pinForm = document.getElementById('pinForm');
    const pinInput = document.getElementById('adminPin');
    const pinError = document.getElementById('pinError');
    const toggleBtn = document.getElementById('togglePinVisibility');

    // Redirect if already logged in
    if (getToken()) {
        window.location.href = 'dashboard.html';
        return;
    }

    // PIN visibility toggle
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = pinInput.type === 'password';
            pinInput.type = isPassword ? 'text' : 'password';
            toggleBtn.innerHTML = isPassword 
                ? '<i class="fas fa-eye-slash"></i>' 
                : '<i class="fas fa-eye"></i>';
        });
    }

    // Only allow numeric input
    if (pinInput) {
        pinInput.addEventListener('input', () => {
            pinInput.value = pinInput.value.replace(/\D/g, '');
        });
    }

    // Form submission
    if (pinForm) {
        pinForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const pin = pinInput.value.trim();

            if (pin.length < 4) {
                showError('PIN must be at least 4 digits');
                return;
            }

            const btn = pinForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Verifying...';
            pinError.classList.add('d-none');

            try {
                const res = await apiFetch('/auth/verify-landing-pin', {
                    method: 'POST',
                    body: JSON.stringify({ pin })
                });

                btn.disabled = false;
                btn.textContent = 'Access System';

                if (res && res.success) {
                    showSuccess('PIN verified! Redirecting...');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 1500);
                } else {
                    pinError.textContent = res?.message || 'Incorrect PIN. Please try again.';
                    pinError.classList.remove('d-none');
                    pinInput.value = '';
                    pinInput.focus();
                }
            } catch (err) {
                btn.disabled = false;
                btn.textContent = 'Access System';
                pinError.textContent = 'Cannot connect to server.';
                pinError.classList.remove('d-none');
                console.error(err);
            }
        });
    }
});