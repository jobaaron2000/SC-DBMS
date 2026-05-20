// ============================================
// js/input-report.js  — Connects to POST /api/reports
// ============================================
document.addEventListener('DOMContentLoaded', async () => {

    if (!getToken()) { window.location.href = 'landing.html'; return; }

    // ---- Photo Upload UI ----
    const btnBrowse  = document.getElementById('btnBrowse');
    const fileInput  = document.getElementById('reportPhoto');
    const uploadText = document.getElementById('uploadText');

    if (btnBrowse && fileInput) {
        btnBrowse.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', function () {
            if (this.files && this.files[0]) {
                uploadText.textContent = `Selected: ${this.files[0].name}`;
                uploadText.classList.add('fw-bold', 'text-success');
            } else {
                uploadText.textContent = 'Drag a photo into this box or browse the file';
                uploadText.classList.remove('fw-bold', 'text-success');
            }
        });
    }

    // ---- Autocomplete: search seniors from real API ----
    const reportNameInput        = document.getElementById('reportName');
    const searchResultsContainer = document.getElementById('nameSearchResults');
    let selectedSeniorId         = null;

    if (reportNameInput && searchResultsContainer) {
        let debounceTimer;

        reportNameInput.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            const query = this.value.trim();
            selectedSeniorId = null; // Reset when user types again

            if (query.length < 2) {
                searchResultsContainer.classList.add('d-none');
                return;
            }

            debounceTimer = setTimeout(async () => {
                const res = await apiFetch(`/seniors?search=${encodeURIComponent(query)}`);
                searchResultsContainer.innerHTML = '';

                if (res && res.success && res.data.length > 0) {
                    searchResultsContainer.classList.remove('d-none');

                    res.data.forEach(senior => {
                        const li = document.createElement('li');
                        li.className = 'search-result-item';
                        li.innerHTML = `<span class="fw-bold">${senior.full_name}</span> <span class="text-muted small ms-1">(ID: ${senior.osca_id})</span>`;

                        li.addEventListener('click', () => {
                            reportNameInput.value  = `${senior.full_name} (${senior.osca_id})`;
                            selectedSeniorId       = senior.id;
                            searchResultsContainer.classList.add('d-none');
                        });

                        searchResultsContainer.appendChild(li);
                    });
                } else {
                    searchResultsContainer.classList.add('d-none');
                }
            }, 300); // 300ms debounce
        });

        document.addEventListener('click', (e) => {
            if (e.target !== reportNameInput && !searchResultsContainer.contains(e.target)) {
                searchResultsContainer.classList.add('d-none');
            }
        });
    }

    // ---- Form Submission ----
    const reportForm = document.getElementById('reportForm');

    if (reportForm) {
        reportForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Validate a senior was actually selected from the dropdown
            if (!selectedSeniorId) {
                showWarning('Please search for and select a senior from the dropdown list.');
                reportNameInput.focus();
                return;
            }

            // Validate proof photo
            if (!fileInput.files || fileInput.files.length === 0) {
                showWarning('Please attach a proof photo before saving the report.');
                return;
            }

            const formData = new FormData();
                    formData.append('senior_id',   selectedSeniorId);
                    formData.append('benefit',     document.getElementById('reportBenefit').value);
                    formData.append('description', document.getElementById('reportDescription').value);
                    formData.append('received_at', document.getElementById('reportDate').value);
                    formData.append('remarks',     document.getElementById('reportRemarks').value || '');

                    // Add this new line right here!
                    formData.append('given_by',    document.getElementById('reportGivenBy').value); 

                    formData.append('proof_photo', fileInput.files[0]);

            const btn = reportForm.querySelector('button[type="submit"]');
            btn.disabled    = true;
            btn.textContent = 'Saving...';

            try {
                const res = await apiFetch('/reports', {
                    method: 'POST',
                    body: formData
                });

                if (res && res.success) {
                    showSuccess('Report saved successfully!');
                    reportForm.reset();
                    selectedSeniorId      = null;
                    uploadText.textContent = 'Drag a photo into this box or browse the file';
                    uploadText.classList.remove('fw-bold', 'text-success');
                    fileInput.value = '';
                } else {
                    showError(res?.message || 'Failed to save report.');
                }
            } catch (err) {
                showError('Cannot connect to server.');
                console.error(err);
            } finally {
                btn.disabled    = false;
                btn.textContent = 'Save';
            }
        });
    }
});
