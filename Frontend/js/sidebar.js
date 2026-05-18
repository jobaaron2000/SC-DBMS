document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const overlay = document.getElementById('sidebarOverlay');

    function openSidebar() {
        if (sidebar) sidebar.classList.remove('collapsed');
        if (overlay) overlay.classList.add('active'); 
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.add('collapsed');
        if (overlay) overlay.classList.remove('active'); 
    }

    // 1. ALWAYS start closed on a new page
    closeSidebar();

    // 2. Handle the Hamburger Button Click
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (sidebar.classList.contains('collapsed')) {
                openSidebar();
            } else {
                closeSidebar();
            }
        });
    }

    // 3. Handle Clicking the Dark Overlay to Close
    if (overlay) {
        overlay.addEventListener('click', () => {
            closeSidebar();
        });
    }

    // 4. Hide Admin nav link if not Admin
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!currentUser || currentUser.position !== 'admin') {
        const adminNavLink = document.querySelector('a[href="admin.html"]');
        if (adminNavLink) adminNavLink.style.display = 'none';
    }

// 5. PROPER LOGOUT FUNCTIONALITY
    const logoutBtn = document.querySelector('.btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault(); 
            
            // TRACKING DEVICE: Check the console to see if this prints!
            console.log("Log Out button was successfully clicked!");
            
            // Destroy the digital ID cards
            localStorage.removeItem('scms_token'); 
            localStorage.removeItem('scms_user');  
            sessionStorage.clear(); 
            
            console.log("Tokens destroyed. Redirecting now...");
            
            // Send the user back to the landing page
            window.location.replace('landing.html');
        });
    }
});