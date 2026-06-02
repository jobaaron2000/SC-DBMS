// ============================================
// js/dashboard.js  — Connects to /api/seniors
// ============================================
document.addEventListener('DOMContentLoaded', async () => {

    if (!getToken()) { window.location.href = 'landing.html'; return; }

    let seniorData = [];
    let currentViewedSeniorId = null; 

    // ---- Load stats ----
    async function loadStats() {
        const res = await apiFetch('/seniors/stats');
        if (res && res.success) {
            document.getElementById('totalSeniorsCount').textContent  = res.data.total;
            document.getElementById('activeSeniorsCount').textContent = res.data.active;
        }
    }

    // ---- Load and render seniors ----
    async function loadSeniors(search = '', status = 'All') {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (status !== 'All') {
            params.set('status', status === 'Deceased' ? 'deceased' : status.toLowerCase());
        }

        const res = await apiFetch(`/seniors?${params.toString()}`);
        if (!res || !res.success) return;

        seniorData = res.data;
        renderTable(seniorData);
    }

    const tableBody = document.getElementById('masterlistBody');

    function renderTable(data) {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No seniors found.</td></tr>`;
            return;
        }

        data.forEach(senior => {
            const statusClass = senior.status === 'active' ? 'status-active' : 'status-deceased';
            const statusLabel = senior.status === 'active' ? 'Active' : 'Deceased';
            
            // Format DB date into WORDS (e.g., "January 1, 1950")
            let dobStr = 'N/A';
            if (senior.date_of_birth) {
                const dateObj = new Date(senior.date_of_birth);
                dobStr = dateObj.toLocaleDateString('en-US', {
                    timeZone: 'UTC', // Prevents the date from shifting backwards by 1 day
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                });
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${senior.osca_id}</td>
                <td>${senior.full_name}</td>
                <td>${dobStr}</td>
                <td>${senior.age}</td>
                <td class="${statusClass}">${statusLabel}</td>
                <td>
                    <button class="btn-view-profile"
                        data-bs-toggle="modal" data-bs-target="#profileModal"
                        data-id="${senior.id}"
                        data-osca="${senior.osca_id}"
                        data-name="${senior.full_name}"
                        data-status="${senior.status}"
                        data-age="${senior.age}"
                        data-gender="${senior.gender}"
                        data-dob="${dobStr}">
                        View Profile
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // ---- Modal population ----
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.addEventListener('show.bs.modal', event => {
            const btn = event.relatedTarget;
            currentViewedSeniorId = btn.getAttribute('data-id');

            document.getElementById('modalName').textContent = btn.getAttribute('data-name');
            document.getElementById('modalId').textContent = btn.getAttribute('data-osca');
            
            const detailName = document.getElementById('modalDetailName');
            if (detailName) detailName.textContent = btn.getAttribute('data-name');
            
            const detailAge = document.getElementById('modalDetailAge');
            if (detailAge) detailAge.textContent = btn.getAttribute('data-age');
            
            const detailGender = document.getElementById('modalDetailGender');
            if (detailGender) detailGender.textContent = btn.getAttribute('data-gender');
            
            const detailDob = document.getElementById('modalDetailDob');
            if (detailDob) detailDob.textContent = btn.getAttribute('data-dob');

            const status = btn.getAttribute('data-status');
            const statusBadge = document.getElementById('modalStatus');
            if(statusBadge) {
                statusBadge.textContent = status === 'active' ? 'Active' : 'Deceased';
                statusBadge.className   = status === 'active' ? 'status-active' : 'status-deceased';
            }

            const btnDeceased = document.getElementById('btnChangeDeceased');
            const btnActive   = document.getElementById('btnChangeActive');

            if (status === 'active') {
                if (btnDeceased) btnDeceased.disabled = false;
                if (btnActive) btnActive.disabled = true;
            } else {
                if (btnDeceased) btnDeceased.disabled = true;
                if (btnActive) btnActive.disabled = false;
            }
        });
    }

    // ---- Function: Update Status in DB ----
    async function updateSeniorStatus(newStatus) {
        if (!currentViewedSeniorId) return;

        const res = await apiFetch(`/seniors/${currentViewedSeniorId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });

        if (res && res.success) {
            await loadSeniors(
                document.getElementById('searchInput')?.value || '',
                document.getElementById('statusFilter')?.value || 'All'
            );
            await loadStats();

            const statusBadge = document.getElementById('modalStatus');
            if(statusBadge) {
                statusBadge.textContent = newStatus === 'active' ? 'Active' : 'Deceased';
                statusBadge.className   = newStatus === 'active' ? 'status-active' : 'status-deceased';
            }

            const btnDeceased = document.getElementById('btnChangeDeceased');
            const btnActive   = document.getElementById('btnChangeActive');
            
            if (newStatus === 'deceased') {
                if(btnDeceased) btnDeceased.disabled = true;
                if(btnActive) btnActive.disabled = false;
            } else {
                if(btnDeceased) btnDeceased.disabled = false;
                if(btnActive) btnActive.disabled = true;
            }
        } else {
            showError(res?.message || 'Failed to update status.');
        }
    }

    // ---- Button Actions ----
    const btnChangeDeceased = document.getElementById('btnChangeDeceased');
    if (btnChangeDeceased) {
        btnChangeDeceased.onclick = async function () {
            if (!this.disabled && confirm('Change senior status to Deceased?')) {
                await updateSeniorStatus('deceased');
            }
        };
    }

    const btnChangeActive = document.getElementById('btnChangeActive');
    if (btnChangeActive) {
        btnChangeActive.onclick = async function () {
            if (!this.disabled && confirm('Change senior status to Active?')) {
                await updateSeniorStatus('active');
            }
        };
    }

    const btnDeleteProfile = document.getElementById('btnDeleteProfile');
    if (btnDeleteProfile) {
        btnDeleteProfile.onclick = async () => {
            if (!currentViewedSeniorId) return;
            if (!confirm('Are you sure you want to permanently delete this profile? This cannot be undone.')) return;

            const res = await apiFetch(`/seniors/${currentViewedSeniorId}`, { method: 'DELETE' });

            if (res && res.success) {
                bootstrap.Modal.getInstance(document.getElementById('profileModal'))?.hide();
                await loadSeniors();
                await loadStats();
            } else {
                showError(res?.message || 'Failed to delete profile.');
            }
        };
    }

    const printBtn = document.getElementById('btnPrintMasterlist');
    if (printBtn) {
        printBtn.addEventListener('click', () => { window.print(); });
    }

    // ---- Calculate Upcoming Birthdays ----
    async function loadUpcomingBirthdays() {
        const res = await apiFetch('/seniors?status=active');
        if (!res || !res.success) return;

        const activeSeniors = res.data;
        const today = new Date();
        today.setHours(0, 0, 0, 0); 
        
        const next30Days = new Date(today);
        next30Days.setDate(today.getDate() + 30);

        let upcomingCount = 0;

        activeSeniors.forEach(senior => {
            if (senior.date_of_birth && senior.date_of_birth !== 'N/A') {
                const dob = new Date(senior.date_of_birth);
                let bdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());

                if (bdayThisYear < today) {
                    bdayThisYear.setFullYear(today.getFullYear() + 1);
                }

                if (bdayThisYear >= today && bdayThisYear <= next30Days) {
                    upcomingCount++;
                }
            }
        });

        const countElement = document.getElementById('upcomingBirthdaysCount');
        if (countElement) countElement.textContent = upcomingCount;
    }

    // ---- Search & Filter Actions ----
    let searchTimeout;
    function applyFilters() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const search = document.getElementById('searchInput')?.value || '';
            const status = document.getElementById('statusFilter')?.value || 'All';
            loadSeniors(search, status);
        }, 300); 
    }

    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);

    await loadStats();
    await loadUpcomingBirthdays(); 
    await loadSeniors();
});