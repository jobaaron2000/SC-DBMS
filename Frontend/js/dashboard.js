// ============================================
// js/dashboard.js  — Connects to /api/seniors
// ============================================
document.addEventListener('DOMContentLoaded', async () => {

    // Guard: must be logged in
    if (!getToken()) { window.location.href = 'landing.html'; return; }

    let seniorData = [];
    let currentViewedSeniorId = null; // Global variable so buttons know who is selected

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
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No seniors found.</td></tr>`;
            return;
        }

        data.forEach(senior => {
            const statusClass = senior.status === 'active' ? 'status-active' : 'status-deceased';
            const statusLabel = senior.status === 'active' ? 'Active' : 'Deceased';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${senior.osca_id}</td>
                <td>${senior.full_name}</td>
                <td>${senior.age}</td>
                <td>${senior.address}</td>
                <td>${senior.contact_number || 'N/A'}</td>
                <td class="${statusClass}">${statusLabel}</td>
                <td>
                    <button class="btn-view-profile"
                        data-bs-toggle="modal" data-bs-target="#profileModal"
                        data-id="${senior.id}"
                        data-osca="${senior.osca_id}"
                        data-name="${senior.full_name}"
                        data-status="${senior.status}"
                        data-age="${senior.age}"
                        data-address="${senior.address}"
                        data-contact="${senior.contact_number || 'N/A'}"
                        data-dob="${senior.birthday || 'N/A'}"
                        data-guardian="${senior.guardian_name || 'N/A'}"
                        data-guardian-contact="${senior.guardian_contact || 'N/A'}">
                        View Profile
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // ---- Modal population (ONLY updates text/UI, no click events inside!) ----
    const profileModal = document.getElementById('profileModal');
    if (profileModal) {
        profileModal.addEventListener('show.bs.modal', event => {
            const btn = event.relatedTarget;
            currentViewedSeniorId = btn.getAttribute('data-id');

            document.getElementById('modalName').textContent              = btn.getAttribute('data-name');
            document.getElementById('modalId').textContent                = btn.getAttribute('data-osca');
            document.getElementById('modalDetailName').textContent        = btn.getAttribute('data-name');
            document.getElementById('modalDetailAge').textContent         = btn.getAttribute('data-age');
            document.getElementById('modalDetailAddress').textContent     = btn.getAttribute('data-address');
            document.getElementById('modalDetailContact').textContent     = btn.getAttribute('data-contact');

            // Format Date of Birth
            const dob = btn.getAttribute('data-dob');
            const formattedDob = dob && dob !== 'N/A' ? dob.split('T')[0] : 'N/A';
            document.getElementById('modalDetailDob').textContent = formattedDob;
            
            document.getElementById('modalDetailGuardian').textContent    = btn.getAttribute('data-guardian');
            document.getElementById('modalDetailGuardianContact').textContent = btn.getAttribute('data-guardian-contact');

            const status = btn.getAttribute('data-status');
            const statusBadge = document.getElementById('modalStatus');
            statusBadge.textContent = status === 'active' ? 'Active' : 'Deceased';
            statusBadge.className   = status === 'active' ? 'status-active' : 'status-deceased';

            // Disable/Enable buttons based on status
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
            // Reload background table and stats
            await loadSeniors(
                document.getElementById('searchInput')?.value || '',
                document.getElementById('statusFilter')?.value || 'All'
            );
            await loadStats();

            // Update modal UI live without closing it
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

    // =========================================================
    // BUTTON ACTIONS (Attached exactly ONCE, outside the modal)
    // =========================================================

    // Change to Deceased Button
    const btnChangeDeceased = document.getElementById('btnChangeDeceased');
    if (btnChangeDeceased) {
        btnChangeDeceased.onclick = async function () {
            if (!this.disabled && confirm('Change senior status to Deceased?')) {
                await updateSeniorStatus('deceased'); // Send strictly what the DB allows
            }
        };
    }

    // Change to Active Button
    const btnChangeActive = document.getElementById('btnChangeActive');
    if (btnChangeActive) {
        btnChangeActive.onclick = async function () {
            if (!this.disabled && confirm('Change senior status to Active?')) {
                await updateSeniorStatus('active'); // Send strictly what the DB allows
            }
        };
    }

    // Delete Profile Button
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

    // Print Button Action
    const printBtn = document.getElementById('btnPrintMasterlist');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
// ---- Calculate Upcoming Birthdays ----
    async function loadUpcomingBirthdays() {
        // Fetch all active seniors to check their birthdays
        const res = await apiFetch('/seniors?status=active');
        if (!res || !res.success) return;

        const activeSeniors = res.data;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to midnight for accurate math
        
        // Define our "upcoming" window (Next 30 Days)
        const next30Days = new Date(today);
        next30Days.setDate(today.getDate() + 30);

        let upcomingCount = 0;

        activeSeniors.forEach(senior => {
            if (senior.birthday && senior.birthday !== 'N/A') {
                const dob = new Date(senior.birthday);
                
                // Create a temporary date for their birthday THIS year
                let bdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());

                // If their birthday already passed this year, look at their birthday next year
                if (bdayThisYear < today) {
                    bdayThisYear.setFullYear(today.getFullYear() + 1);
                }

                // If the birthday falls between today and 30 days from now, count it!
                if (bdayThisYear >= today && bdayThisYear <= next30Days) {
                    upcomingCount++;
                }
            }
        });

        // Update the dashboard UI
        const countElement = document.getElementById('upcomingBirthdaysCount');
        if (countElement) countElement.textContent = upcomingCount;
    }
    // ---- Search & Filter Actions (Upgraded with Debounce) ----
        let searchTimeout;

        function applyFilters() {
            clearTimeout(searchTimeout); // Reset the timer on every keystroke
            
            // Wait 300ms after the user stops typing before asking the server
            searchTimeout = setTimeout(() => {
                const search = document.getElementById('searchInput')?.value || '';
                const status = document.getElementById('statusFilter')?.value || 'All';
                loadSeniors(search, status);
            }, 300); 
        }

        const searchInput = document.getElementById('searchInput');
        const statusFilter = document.getElementById('statusFilter');

        // Attach listeners and add a console warning if the HTML ID is wrong
        if (searchInput) {
            searchInput.addEventListener('input', applyFilters);
        } else {
            console.warn("⚠️ Cannot find 'searchInput' in the HTML!");
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', applyFilters);
        }
// ---- Initial load ----
    await loadStats();
    await loadUpcomingBirthdays(); 
    await loadSeniors();
});