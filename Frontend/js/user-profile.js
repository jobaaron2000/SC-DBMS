// ============================================
// js/user-profile.js  — OTP-based password change
// Connects to /api/auth/request-otp & /api/auth/verify-otp-and-change-password
// ============================================
document.addEventListener('DOMContentLoaded', async () => {

    if (!getToken()) { window.location.href = 'landing.html'; return; }

    // ---- Load profile data ----
    const res = await apiFetch('/users/me');
    if (res && res.success) {
        const u = res.data;
        const positionLabel = u.position === 'admin' ? 'Admin' : 'User';

        // Safely check if the element exists before setting textContent
        const nameEl = document.getElementById('profileName');
        if (nameEl) nameEl.textContent = u.full_name;

        const positionEl = document.getElementById('profilePosition');
        if (positionEl) positionEl.textContent = positionLabel;

        const emailEl = document.getElementById('profileEmail');
        if (emailEl) emailEl.textContent = u.email;

        const statusEl = document.getElementById('profileStatus');
        if (statusEl) statusEl.textContent = u.status === 'active' ? 'Active' : 'Inactive';
        
    } else {
        showError('Failed to load profile. Please log in again.');
        window.location.href = 'login.html';
        return;
    }

    // ---- Toggle password visibility ----
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

    // ============================================
    // 2-STEP PASSWORD CHANGE WITH OTP
    // ============================================
    const otpRequestForm     = document.getElementById('otpRequestForm');
    const passwordChangeForm = document.getElementById('passwordChangeForm');
    const otpRequestStep     = document.getElementById('otpRequestStep');
    const otpVerifyStep      = document.getElementById('otpVerifyStep');
    const errorMsg           = document.getElementById('passwordErrorMsg');
    const successMsg         = document.getElementById('passwordSuccessMsg');
    const resendLink         = document.getElementById('resendOtpLink');
    const backLink           = document.getElementById('backToPasswordStep');

    let currentPassword = '';  // Store for verification

    // ---- STEP 1: Request OTP ----
    // ---- STEP 1: Request OTP ----
    if (otpRequestForm) {
        otpRequestForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const btn = otpRequestForm.querySelector('button[type="submit"]');
            btn.disabled    = true;
            btn.textContent = 'Sending OTP...';
            clearMessages();

            // Request OTP from backend (No longer sending currentPassword)
            const sendRes = await apiFetch('/auth/request-otp', {
                method: 'POST'
            });

            btn.disabled    = false;
            btn.textContent = 'Send OTP';

            if (sendRes && sendRes.success) {
                showSuccess('OTP sent to your email! Check your inbox.');
                setTimeout(() => {
                    otpRequestStep.classList.add('d-none');
                    otpVerifyStep.classList.remove('d-none');
                }, 1000);
            } else {
                showError(sendRes?.message || 'Failed to send OTP. Please try again.');
            }
        });
    }

    // ---- STEP 2: Verify OTP & Change Password ----
    if (passwordChangeForm) {
        passwordChangeForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const otpCode              = document.getElementById('otpCode').value.trim();
            const newPassword          = document.getElementById('newPassword').value;
            const confirmNewPassword   = document.getElementById('confirmNewPassword').value;

            if (!otpCode || otpCode.length !== 6) {
                showError('Please enter a valid 6-digit OTP.');
                return;
            }

            if (newPassword !== confirmNewPassword) {
                showError('New passwords do not match!');
                return;
            }

            if (newPassword.length < 8) {
                showError('Password must be at least 8 characters.');
                return;
            }

            const btn = passwordChangeForm.querySelector('button[type="submit"]');
            btn.disabled    = true;
            btn.textContent = 'Verifying...';
            clearMessages();

            // Send OTP verification and new password to backend
            const verifyRes = await apiFetch('/auth/verify-otp-and-change-password', {
                method: 'POST',
                body: JSON.stringify({
                    otp: otpCode,
                    newPassword: newPassword // currentPassword removed
                })
            });

            btn.disabled    = false;
            btn.textContent = 'Confirm & Change Password';

            if (verifyRes && verifyRes.success) {
                showSuccess('Password changed successfully!');
                // Reset form and close modal after 2 seconds
                setTimeout(() => {
                    otpRequestForm.reset();
                    passwordChangeForm.reset();
                    otpVerifyStep.classList.add('d-none');
                    otpRequestStep.classList.remove('d-none');
                    bootstrap.Modal.getInstance(document.getElementById('passwordModal'))?.hide();
                }, 2000);
            } else {
                showError(verifyRes?.message || 'Failed to change password. Please try again.');
            }
        });
    }

    // ---- Resend OTP ----
    if (resendLink) {
        resendLink.addEventListener('click', async (e) => {
            e.preventDefault();
            clearMessages();

            const btn = resendLink;
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.5';
            btn.textContent = 'Sending...';

           const resendRes = await apiFetch('/auth/request-otp', {
                method: 'POST' // Removed body completely
            });

            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            btn.textContent = 'Resend OTP';

            if (resendRes && resendRes.success) {
                showSuccess('New OTP sent to your email!');
            } else {
                showError(resendRes?.message || 'Failed to resend OTP.');
            }
        });
    }

    // ---- Back to password step ----
    if (backLink) {
        backLink.addEventListener('click', (e) => {
            e.preventDefault();
            otpVerifyStep.classList.add('d-none');
            otpRequestStep.classList.remove('d-none');
            passwordChangeForm.reset();
            clearMessages();
        });
    }

    // ---- Helper functions ----
    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.remove('d-none');
        successMsg.classList.add('d-none');
    }

    function showSuccess(message) {
        successMsg.textContent = message;
        successMsg.classList.remove('d-none');
        errorMsg.classList.add('d-none');
    }

    function clearMessages() {
        errorMsg.classList.add('d-none');
        successMsg.classList.add('d-none');
    }

    // ---- Reset messages when modal is shown/hidden ----
    const passwordModal = document.getElementById('passwordModal');
    if (passwordModal) {
        passwordModal.addEventListener('hidden.bs.modal', () => {
            otpRequestForm.reset();
            passwordChangeForm.reset();
            otpVerifyStep.classList.add('d-none');
            otpRequestStep.classList.remove('d-none');
            clearMessages();
            currentPassword = '';
        });
    }
});
