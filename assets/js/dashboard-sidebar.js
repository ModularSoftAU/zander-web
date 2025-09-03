document.addEventListener("DOMContentLoaded", function(event) {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('overlay');
    const navDropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');

    function handleSidebarToggle() {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('toggled');
            overlay.classList.toggle('active');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    }

    sidebarToggle.addEventListener('click', handleSidebarToggle);

    overlay.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('toggled');
            overlay.classList.remove('active');
        }
    });

    navDropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            if (sidebar.classList.contains('collapsed') && window.innerWidth > 768) {
                // Prevent dropdown opening when sidebar is collapsed on desktop
                return;
            }
            const dropdown = toggle.closest('.nav-dropdown');
            dropdown.classList.toggle('open');
        });
    });
});
