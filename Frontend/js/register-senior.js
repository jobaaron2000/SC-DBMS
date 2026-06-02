document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. PROHIBIT SPECIAL CHARACTERS IN NAMES
    // ==========================================
    const nameInputs = document.querySelectorAll('#regFirstName, #regMiddleName, #regLastName');

    nameInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', function() {
                // Allows ONLY: Letters, spaces, hyphens, and periods
                this.value = this.value.replace(/[^a-zA-Z\s\-.]/g, '');
            });
        }
    });

    // ==========================================
    // 2. SECURITY: GET TOKEN
    // ==========================================
    const getToken = () => sessionStorage.getItem('token');

    // ==========================================
    // 3. MANUAL SINGLE REGISTRATION
    // ==========================================
    const registerForm = document.getElementById('registerSeniorForm');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Stitch the full name together
            const first = document.getElementById('regFirstName').value.trim();
            const middle = document.getElementById('regMiddleName').value.trim();
            const last = document.getElementById('regLastName').value.trim();
            const suffix = document.getElementById('regSuffix').value.trim();
            const fullName = `${first} ${middle} ${last} ${suffix}`.replace(/\s+/g, ' ').trim();

            // Calculate Age from Birthday
            const birthDate = new Date(document.getElementById('regBirthday').value);
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                calculatedAge--;
            }

            // The Lean Payload (Matching the new Database Structure)
            const newSenior = {
                osca_id: document.getElementById('regOscaId').value.trim(),
                full_name: fullName,
                gender: document.getElementById('regGender').value,
                date_of_birth: document.getElementById('regBirthday').value,
                age: calculatedAge
            };

            try {
                // Loading State
                const btnSubmit = registerForm.querySelector('button[type="submit"]');
                const originalText = btnSubmit.innerHTML;
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
                btnSubmit.disabled = true;

                // Send to backend using the global API_BASE variable
                const response = await fetch(`${API_BASE}/seniors`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getToken()}` 
                    },
                    body: JSON.stringify(newSenior)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showToast("Senior registered successfully!", "success");
                    registerForm.reset(); 
                } else {
                    showToast(data.message || "Failed to register senior. Make sure you are logged in.", "error");
                }

                // Restore Button
                btnSubmit.innerHTML = originalText;
                btnSubmit.disabled = false;

            } catch (error) {
                console.error("Error registering senior:", error);
                showToast("Server error. Please try again.", "error");
            }
        });
    }

    // ==========================================
    // 4. BULK CSV UPLOAD LOGIC
    // ==========================================
    const csvFileInput = document.getElementById('csvFileInput');
    const btnUploadCsv = document.getElementById('btnUploadCsv');
    const csvFileName = document.getElementById('csvFileName');

    // Show the file name when they select a file
    if (csvFileInput) {
        csvFileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                csvFileName.textContent = `Selected: ${this.files[0].name}`;
                csvFileName.classList.remove('d-none');
            }
        });
    }

    // Handle the Upload button click
    if (btnUploadCsv) {
        btnUploadCsv.addEventListener('click', async () => {
            const file = csvFileInput.files[0];
            if (!file) {
                showToast("Please choose a CSV file first.", "warning");
                return;
            }

            const formData = new FormData();
            formData.append('csvFile', file);

            try {
                btnUploadCsv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
                btnUploadCsv.disabled = true;

                // Send to the backend using the global API_BASE variable
                const response = await fetch(`${API_BASE}/seniors/bulk-upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${getToken()}` 
                    },
                    body: formData 
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showToast(data.message, "success");
                    
                    if (data.errors && data.errors.length > 0) {
                        console.warn("Upload Errors:", data.errors);
                        alert("Warning: Some rows were skipped because they had missing data. \n\n" + data.errors.join("\n"));
                    }

                    csvFileInput.value = '';
                    if (csvFileName) csvFileName.classList.add('d-none');
                } else {
                    showToast(data.message || "Upload failed. Make sure you are logged in.", "error");
                }
            } catch (error) {
                console.error("Upload error:", error);
                showToast("Failed to upload the file.", "error");
            } finally {
                btnUploadCsv.innerHTML = 'Upload & Save';
                btnUploadCsv.disabled = false;
            }
        });
    }
});