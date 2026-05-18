// ============================================
// js/view-reports.js  — Connects to /api/reports
// ============================================
document.addEventListener('DOMContentLoaded', async () => {

    if (!getToken()) { window.location.href = 'landing.html'; return; }

    const tableBody           = document.getElementById('reportsTableBody');
    const reportSearchInput   = document.getElementById('reportSearchInput');
    let currentViewedReportId = null;

    // ---- Load and render reports ----
    async function loadReports(search = '') {
        const params = new URLSearchParams();
        if (search) params.set('search', search);

        const res = await apiFetch(`/reports?${params.toString()}`);

        if (!res || !res.success) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Failed to load reports.</td></tr>`;
            return;
        }

        renderTable(res.data);
    }

    function renderTable(data) {
        tableBody.innerHTML = '';

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No reports found.</td></tr>`;
            return;
        }

        data.forEach(report => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${report.senior_name} (${report.osca_id})</td>
                <td>${report.benefit}</td>
                <td>${report.date} / ${report.time}</td>
                <td>${report.given_by}</td>
                <td>
                    ${report.proof_url
                            ? `<a href="http://localhost:3000${report.proof_url}" target="_blank"><div class="proof-box" title="View Proof">📷</div></a>`
                            : `<div class="proof-box"></div>`
                    }
                </td>
                <td>
                    <button class="btn btn-view-action"
                        data-bs-toggle="modal" data-bs-target="#reportModal"
                        data-report-id="${report.id}">View</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // ---- Handle "View" button clicks ----
    tableBody.addEventListener('click', async (e) => {
        if (!e.target.classList.contains('btn-view-action')) return;

        const reportId = e.target.getAttribute('data-report-id');
        currentViewedReportId = reportId;

        const res = await apiFetch(`/reports/${reportId}`);
        if (!res || !res.success) return;

        const r = res.data;
        document.getElementById('detailReportName').textContent    = `${r.senior_name} (${r.osca_id})`;
        // Show proof photo in modal
        const photoBox = document.querySelector('.report-modal-photo');
        if (r.proof_url) {
        photoBox.innerHTML = `<img src="http://localhost:3000${r.proof_url}" 
        style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;
        }  else {
    photoBox.innerHTML = 'No Photo';
}
        document.getElementById('detailReportBenefit').textContent = r.benefit;
        document.getElementById('detailReportDesc').textContent    = r.description || 'N/A';
        document.getElementById('detailReportDate').textContent    = r.received_at ? new Date(r.received_at).toLocaleDateString('en-PH') : 'N/A';
        document.getElementById('detailReportTime').textContent    = r.received_at ? new Date(r.received_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
        document.getElementById('detailReportRemarks').textContent = r.remarks || 'None';
    });

    // ---- Delete report ----
    document.getElementById('btnDeleteReport')?.addEventListener('click', async () => {
        if (!currentViewedReportId) return;
        if (!confirm('Are you sure you want to permanently delete this report? This cannot be undone.')) return;

        const res = await apiFetch(`/reports/${currentViewedReportId}`, { method: 'DELETE' });

        if (res && res.success) {
            bootstrap.Modal.getInstance(document.getElementById('reportModal'))?.hide();
            await loadReports(reportSearchInput?.value || '');
        } else {
            showError(res?.message || 'Failed to delete report.');
        }
    });

    // ---- Search ----
    let debounce;
    reportSearchInput?.addEventListener('input', function () {
        clearTimeout(debounce);
        debounce = setTimeout(() => loadReports(this.value.trim()), 300);
    });

    // ---- Initial load ----
    await loadReports();
});
