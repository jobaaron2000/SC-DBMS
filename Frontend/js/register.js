// ==========================================
    // INPUT VALIDATION & FORMATTING
    // ==========================================

    // 1. Disable numbers & special characters for names (allows letters, spaces, ñ, and hyphens)
    function cleanNameInput(e) {
        e.target.value = e.target.value.replace(/[^a-zA-ZñÑ\s-]/g, '');
    }

    const nameInputs = ['firstName', 'lastName', 'middleName', 'suffix'];
    nameInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', cleanNameInput);
        }
    });

    // 2. Force phone numbers to be 11 digits and NEVER let them erase "09"
    function enforcePhoneNumber(e) {
        // Remove all letters and symbols
        let val = e.target.value.replace(/\D/g, '');

        // If they try to delete the '09', instantly put it back
        if (val.length < 2) {
            val = '09';
        } 
        // Force '09' at the front if missing
        else if (!val.startsWith('09')) {
            val = '09' + val.replace(/^[09]+/, '');
        }

        // Ensure it never goes past 11 digits
        e.target.value = val.substring(0, 11);
    }

    const phoneInput = document.getElementById('phoneNo');
    if (phoneInput) {
        phoneInput.addEventListener('input', enforcePhoneNumber);
    }

document.addEventListener('DOMContentLoaded', () => {

    const form             = document.getElementById('adminRegisterForm');
    const positionSelect   = document.getElementById('brgyPosition');
    const passcodeContainer= document.getElementById('adminPasscodeContainer');
    const passcodeInput    = document.getElementById('adminPasscode');
    const phoneInput       = document.getElementById('phoneNo');

    // ---- Show/hide Master PIN box ----
    function togglePasscodeBox() {
        if (positionSelect.value === 'admin') {
            passcodeContainer.classList.remove('force-hide');
            passcodeInput.setAttribute('required', 'true');
        } else {
            passcodeContainer.classList.add('force-hide');
            passcodeInput.removeAttribute('required');
            passcodeInput.value = '';
        }
    }
    if (positionSelect) {
        togglePasscodeBox();
        positionSelect.addEventListener('change', togglePasscodeBox);
    }

    // ---- Numeric-only inputs ----
    if (phoneInput)    phoneInput.addEventListener('input',    () => { phoneInput.value    = phoneInput.value.replace(/\D/g, ''); });
    if (passcodeInput) passcodeInput.addEventListener('input', () => { passcodeInput.value = passcodeInput.value.replace(/\D/g, ''); });

    // ---- Form submit ----
    if (form) {
        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            const firstName = document.getElementById('firstName').value.trim();
            const lastName  = document.getElementById('lastName').value.trim();
            const middleName= document.getElementById('middleName').value.trim();
            const suffix    = document.getElementById('suffix').value.trim();
            const email     = document.getElementById('username').value.trim();
            const password  = document.getElementById('password').value;
            const confirm   = document.getElementById('reenterPassword').value;
            const position  = document.getElementById('brgyPosition').value;
            const masterPin = passcodeInput ? passcodeInput.value : '';

            if (password !== confirm) {
                showError('Passwords do not match!');
                return;
            }

            const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
            if (!passwordRegex.test(password)) {
                showWarning('Password must be at least 8 characters and include:\n- 1 uppercase letter\n- 1 number\n- 1 special character (!@#$%^&*)');
                return;
            }

            if (position === 'admin' && masterPin.length < 4) {
                showWarning('Master PIN must be at least 4 digits.');
                return;
            }

            const btn = form.querySelector('button[type="submit"]');
            btn.disabled    = true;
            btn.textContent = 'Registering...';

            try {
                const res = await apiFetch('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({
                        firstName, lastName, middleName, suffix,
                        email, password, position,
                        masterPin: position === 'admin' ? masterPin : undefined
                    })
                });

                if (res.ok && res.success) {
                    showSuccess('Account registered successfully! You can now log in.');
                    window.location.href = 'login.html';
                } else {
                    showError(res.message || 'Registration failed. Please try again.');
                }
            } catch (err) {
                showError('Cannot connect to server. Make sure the backend is running.');
                console.error(err);
            } finally {
                btn.disabled    = false;
                btn.textContent = 'Register';
            }
        });
    }
});