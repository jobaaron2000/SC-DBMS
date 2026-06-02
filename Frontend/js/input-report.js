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

    // ---- Load Seniors into Dropdown ----
    const seniorSelect = document.getElementById('reportSeniorId');
    if (seniorSelect) {
        async function populateSeniors() {
            // Fetch all active seniors from the Masterlist
            const res = await apiFetch('/seniors?status=active'); 
            
            if (res && res.success) {
                res.data.forEach(senior => {
                    const option = document.createElement('option');
                    option.value = senior.id; // This is the ID the database needs
                    option.textContent = `${senior.full_name} (OSCA ID: ${senior.osca_id})`;
                    seniorSelect.appendChild(option);
                });
            }
        }
        populateSeniors(); // Run the function when the page loads
    }

    // ---- Form Submission ----
    const reportForm = document.getElementById('reportForm');

    if (reportForm) {
        reportForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Grab the ID directly from our new dropdown menu
            const selectedSeniorId = document.getElementById('reportSeniorId').value;

            // Validate a senior was actually selected
            if (!selectedSeniorId) {
                showWarning('Please select a senior from the dropdown list.');
                document.getElementById('reportSeniorId').focus();
                return;
            }

            const formData = new FormData();
            formData.append('senior_id',   selectedSeniorId);
            formData.append('benefit',     document.getElementById('reportBenefit').value);
            formData.append('description', document.getElementById('reportDescription').value);
            formData.append('received_at', document.getElementById('reportDate').value);
            formData.append('remarks',     document.getElementById('reportRemarks').value || '');
            formData.append('given_by',    document.getElementById('reportGivenBy').value); 

            // Handle the optional photo
            if (fileInput.files && fileInput.files.length > 0) {
                const photoFile = fileInput.files[0];
                const maxFileSize = 4 * 1024 * 1024; // 4MB in bytes

                if (photoFile.size > maxFileSize) {
                    showWarning('The photo is too large! Please choose an image smaller than 4MB.');
                    return;
                }
                
                formData.append('proof_photo', photoFile);
            }

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
                    
                    // Reset the upload box UI manually since reportForm.reset() doesn't trigger the change event
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