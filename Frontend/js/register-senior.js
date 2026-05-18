document.addEventListener('DOMContentLoaded', () => {
    
    // Helper function to safely get the token
    const getToken = () => localStorage.getItem('token');

    // ==========================================
    // 1. MANUAL SINGLE REGISTRATION
    // ==========================================
    const registerForm = document.getElementById('registerSeniorForm');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get the name parts
            const first = document.getElementById('regFirstName').value.trim();
            const middle = document.getElementById('regMiddleName').value.trim();
            const last = document.getElementById('regLastName').value.trim();
            const suffix = document.getElementById('regSuffix').value.trim();
            
            // Stitch the full name together
            const fullName = `${first} ${middle} ${last} ${suffix}`.replace(/\s+/g, ' ').trim();

            const newSenior = {
                osca_id: document.getElementById('regOscaId').value.trim(),
                full_name: fullName,
                birthday: document.getElementById('regBirthday').value,
                address: document.getElementById('regAddress').value.trim(),
                contact_number: document.getElementById('regPhone').value.trim() || null,
                guardian_name: document.getElementById('regGuardianName').value.trim() || null,
                guardian_contact: document.getElementById('regGuardianContact').value.trim() || null,
                status: 'Active'
            };

            try {
                // Loading State
                const btnSubmit = registerForm.querySelector('button[type="submit"]');
                const originalText = btnSubmit.innerHTML;
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
                btnSubmit.disabled = true;

                // Send to backend WITH THE TOKEN
                const response = await fetch('http://localhost:3000/api/seniors', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getToken()}` // <--- FIX: Added the Token here!
                    },
                    body: JSON.stringify(newSenior)
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showToast("Senior registered successfully!", "success");
                    registerForm.reset(); 
                    
                    // Put the "09" back in the phone inputs after reset
                    document.getElementById('regPhone').value = '09';
                    document.getElementById('regGuardianContact').value = '09';
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
    // 2. BULK CSV UPLOAD LOGIC
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

                // Send to the backend WITH THE TOKEN
                const response = await fetch('http://localhost:3000/api/seniors/bulk-upload', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${getToken()}` // <--- FIX: Added the Token here too!
                        // Do NOT add 'Content-Type' for FormData, let the browser handle it.
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
                    csvFileName.classList.add('d-none');
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