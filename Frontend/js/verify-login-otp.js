document.addEventListener('DOMContentLoaded', () => {
    // Check if user came from login
    const loginEmail = sessionStorage.getItem('loginEmail');
    if (!loginEmail) {
        window.location.href = 'login.html';
        return;
    }

    // Only allow numeric input
    const otpInput = document.getElementById('otpInput');
    if (otpInput) {
        otpInput.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '');
        });
    }

    const otpForm = document.getElementById('otpVerifyForm');
    if (otpForm) {
        otpForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const otp = document.getElementById('otpInput').value;
            const otpError = document.getElementById('otpError');
            const btn = otpForm.querySelector('button[type="submit"]');

            otpError.classList.add('d-none');

            if (otp.length !== 6) {
                otpError.textContent = 'OTP must be 6 digits.';
                otpError.classList.remove('d-none');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Verifying...';

            try {
                const res = await apiFetch('/auth/verify-login-otp', {
                    method: 'POST',
                    body: JSON.stringify({ email: loginEmail, otp })
                });

                btn.disabled = false;
                btn.textContent = 'Verify OTP';

                if (res.success) {
                    // Get stored login data
                    const token = sessionStorage.getItem('loginToken');
                    const user = JSON.parse(sessionStorage.getItem('loginUser'));

                    // Save to localStorage (permanent)
                    saveToken(token);
                    saveCurrentUser(user);

                    // Clear temp session data
                    sessionStorage.removeItem('loginToken');
                    sessionStorage.removeItem('loginUser');
                    sessionStorage.removeItem('loginEmail');

                    showSuccess('OTP verified! Logging in...');
                    window.location.href = 'dashboard.html';
                } else {
                    otpError.textContent = res?.message || 'Invalid OTP. Please try again.';
                    otpError.classList.remove('d-none');
                    document.getElementById('otpInput').value = '';
                    document.getElementById('otpInput').focus();
                }
            } catch (err) {
                btn.disabled = false;
                btn.textContent = 'Verify OTP';
                otpError.textContent = 'Cannot connect to server.';
                otpError.classList.remove('d-none');
                console.error(err);
            }
        });
    }
});