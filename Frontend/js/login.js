document.addEventListener('DOMContentLoaded', () => {

    const loginForm = document.getElementById('adminLoginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const email    = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const btn      = loginForm.querySelector('button[type="submit"]');

        btn.disabled    = true;
        btn.textContent = 'Logging in...';

        try {
            const res = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            btn.disabled    = false;
            btn.textContent = 'Log In';

            if (res.ok && res.success) {
    // Credentials valid — now send OTP
    const otpRes = await apiFetch('/auth/send-login-otp', {
        method: 'POST',
        body: JSON.stringify({ email })
    });

    if (otpRes.success) {
        // Store login data for OTP verification
        sessionStorage.setItem('loginEmail', email);
        sessionStorage.setItem('loginToken', res.token);
        sessionStorage.setItem('loginUser', JSON.stringify(res.user));
        
        showSuccess('OTP sent to your email. Please verify to continue.');
        setTimeout(() => {
            window.location.href = 'verify-login-otp.html';
        }, 2000);
    } else {
    console.log('✗ OTP send failed:', otpRes?.message);
    showError(otpRes?.message || 'Failed to send OTP. Please try again.');
}
            } else {
                showError(res.message || 'Incorrect email or password. Please try again.');
            }
        } catch (err) {
            showError('Cannot connect to server. Make sure the backend is running.');
            console.error(err);
            btn.disabled    = false;
            btn.textContent = 'Log In';
        }
    });
}

    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', function () {
            const input = this.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                this.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                this.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // Forgot Password
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('resetEmail').value = '';
            document.getElementById('resetMessage').classList.add('d-none');
            document.getElementById('resetError').classList.add('d-none');
            const modal = new bootstrap.Modal(document.getElementById('forgotPasswordModal'));
            modal.show();
        });
    }

    const btnSendOtp = document.getElementById('btnSendOtp');
    if (btnSendOtp) {
        btnSendOtp.addEventListener('click', async () => {
            const email = document.getElementById('resetEmail').value.trim();
            const resetMessage = document.getElementById('resetMessage');
            const resetError = document.getElementById('resetError');

            resetMessage.classList.add('d-none');
            resetError.classList.add('d-none');

            if (!email) {
                resetError.textContent = 'Please enter your email.';
                resetError.classList.remove('d-none');
                return;
            }

            btnSendOtp.disabled = true;
            btnSendOtp.textContent = 'Sending OTP...';

            try {
                const res = await apiFetch('/auth/send-otp', {
                    method: 'POST',
                    body: JSON.stringify({ email })
                });

                btnSendOtp.disabled = false;
                btnSendOtp.textContent = 'Send OTP';

                if (res.success) {
                    resetMessage.textContent = 'OTP sent to your email!';
                    resetMessage.classList.remove('d-none');
                    // Store email for OTP verification
                    sessionStorage.setItem('resetEmail', email);
                    setTimeout(() => {
                        bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal'))?.hide();
                        // Redirect to OTP verification page
                        window.location.href = 'verify-otp.html';
                    }, 2000);
                } else {
                    resetError.textContent = res?.message || 'Failed to send OTP.';
                    resetError.classList.remove('d-none');
                }
            } catch (err) {
                btnSendOtp.disabled = false;
                btnSendOtp.textContent = 'Send OTP';
                resetError.textContent = 'Cannot connect to server.';
                resetError.classList.remove('d-none');
                console.error(err);
            }
        });
    }
});