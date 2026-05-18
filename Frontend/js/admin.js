// ============================================
// js/admin.js  — Connects to /api/users & /api/auth/verify-pin
// ============================================
document.addEventListener('DOMContentLoaded', async () => {

    if (!getToken()) { window.location.href = 'landing.html'; return; }

    // ============================================
    // 1. CHECK IF USER IS ADMIN
    // ============================================
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.position !== 'admin') {
        showError('Access denied. Only Admin can access this page.');
        window.location.href = 'dashboard.html';
        return;
    }

    // ============================================
    // 2. SECURITY LOCK — verify PIN
    // ============================================
    const adminModalElement = document.getElementById('adminAuthModal');
    if (adminModalElement) {
        const adminAuthModal = new bootstrap.Modal(adminModalElement);
        const appWrapper     = document.querySelector('.app-wrapper');
        const pinInput       = document.getElementById('adminPinInput');
        const btnVerify      = document.getElementById('btnVerifyPin');
        const errorMsg       = document.getElementById('pinErrorMessage');

        if (sessionStorage.getItem('adminUnlocked') !== 'true') {
            appWrapper.classList.add('content-locked');
            adminAuthModal.show();
        }

        async function verifyAdminAccess() {
            btnVerify.disabled    = true;
            btnVerify.textContent = 'Verifying...';

            const res = await apiFetch('/auth/verify-pin', {
                method: 'POST',
                body: JSON.stringify({ pin: pinInput.value })
            });

            btnVerify.disabled    = false;
            btnVerify.textContent = 'Unlock Admin';

            if (res && res.success) {
                sessionStorage.setItem('adminUnlocked', 'true');
                appWrapper.classList.remove('content-locked');
                adminAuthModal.hide();
                loadPageData();
            } else {
                errorMsg.classList.remove('d-none');
                pinInput.value = '';
                pinInput.focus();
            }
        }

        btnVerify?.addEventListener('click', verifyAdminAccess);
        pinInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') verifyAdminAccess(); });

        if (sessionStorage.getItem('adminUnlocked') === 'true') {
            loadPageData();
        }
    }

    // ============================================
    // 3. LOAD PAGE DATA
    // ============================================
    async function loadPageData() {
        const meRes = await apiFetch('/users/me');
        if (meRes && meRes.success) {
            const u = meRes.data;
            document.getElementById('adminProfileName').textContent     = u.full_name;
            document.getElementById('adminProfilePosition').textContent = u.position;
            document.getElementById('adminProfileEmail').textContent    = u.email;
        }

        await loadUsersTable();
    }

    // ============================================
    // 4. RENDER USERS TABLE
    // ============================================
    const tableBody = document.getElementById('adminUsersTableBody');

    async function loadUsersTable() {
        const res = await apiFetch('/users');
        if (!res || !res.success) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Failed to load users.</td></tr>`;
            return;
        }
        renderTable(res.data);
    }

    function renderTable(usersList) {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (usersList.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No users registered yet.</td></tr>`;
            return;
        }

        const currentUserId = getCurrentUser()?.id;

        usersList.forEach(user => {
            const isAdmin        = user.position === 'admin';
            const isSelf         = user.id === currentUserId;
            const statusColor    = user.status === 'active' ? 'admin-status-active fw-bold' : 'text-danger fw-bold';
            const enableDimmed   = user.status === 'active'   ? 'opacity-50' : '';
            const disableDimmed  = user.status === 'inactive' ? 'opacity-50' : '';

            let actionCell;
            if (isAdmin) {
                actionCell = `<span class="text-muted small">System Admin</span>`;
            } else if (isSelf) {
                actionCell = `<span class="text-muted small">You</span>`;
            } else {
                actionCell = `
                    <div class="d-flex gap-2">
                        <button class="btn btn-action-enable ${enableDimmed}"  data-action="enable"  data-id="${user.id}">Enable</button>
                        <button class="btn btn-action-disable ${disableDimmed}" data-action="disable" data-id="${user.id}">Disable</button>
                    </div>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.full_name}</td>
                <td>${user.position}</td>
                <td>${user.email}</td>
                <td class="${statusColor}">${user.status === 'active' ? 'Active' : 'Disabled'}</td>
                <td>${actionCell}</td>
                <td>
                    <input type="text" class="admin-remarks-input" data-id="${user.id}"
                        value="${user.remarks || ''}" placeholder="Add remark..."
                        ${isAdmin ? 'disabled' : ''}>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // ============================================
    // 5. ENABLE / DISABLE BUTTON CLICKS
    // ============================================
    tableBody?.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;

        const action    = btn.getAttribute('data-action');
        const userId    = btn.getAttribute('data-id');
        const newStatus = action === 'enable' ? 'active' : 'inactive';

        if (action === 'disable') {
            if (!confirm('Are you sure you want to disable this account?')) return;
        }

        const res = await apiFetch(`/users/${userId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });

        if (res && res.success) {
            await loadUsersTable();
        } else {
            showError(res?.message || 'Failed to update status.');
        }
    });

    // ============================================
    // 6. AUTO-SAVE REMARKS ON CHANGE
    // ============================================
    tableBody?.addEventListener('change', async (e) => {
        if (!e.target.classList.contains('admin-remarks-input')) return;

        const userId  = e.target.getAttribute('data-id');
        const remarks = e.target.value;

        await apiFetch(`/users/${userId}/remarks`, {
            method: 'PATCH',
            body: JSON.stringify({ remarks })
        });
    });
});