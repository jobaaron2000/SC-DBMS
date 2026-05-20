document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const overlay = document.getElementById('sidebarOverlay');

    // Helper function to check if the user is on a mobile phone
    const isMobile = () => window.innerWidth <= 768;

    function openSidebar() {
        if (isMobile()) {
            // Mobile: Slide the sidebar in and show the dark overlay
            if (sidebar) sidebar.classList.add('show');
            if (overlay) overlay.classList.add('show'); 
        } else {
            // Desktop: Expand the sidebar
            if (sidebar) sidebar.classList.remove('collapsed');
        }
    }

    function closeSidebar() {
        if (isMobile()) {
            // Mobile: Slide the sidebar out and hide the dark overlay
            if (sidebar) sidebar.classList.remove('show');
            if (overlay) overlay.classList.remove('show'); 
        } else {
            // Desktop: Shrink the sidebar
            if (sidebar) sidebar.classList.add('collapsed');
        }
    }

    // 1. ALWAYS start closed on a new page
    closeSidebar();

    // 2. Handle the Hamburger Button Click
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (isMobile()) {
                // Mobile toggle check
                if (sidebar.classList.contains('show')) {
                    closeSidebar();
                } else {
                    openSidebar();
                }
            } else {
                // Desktop toggle check
                if (sidebar.classList.contains('collapsed')) {
                    openSidebar();
                } else {
                    closeSidebar();
                }
            }
        });
    }

    // 3. Handle Clicking the Dark Overlay to Close (Mobile)
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