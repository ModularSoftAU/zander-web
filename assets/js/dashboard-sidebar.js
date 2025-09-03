document.addEventListener("DOMContentLoaded", function(event) {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const navDropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    navDropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const dropdown = toggle.closest('.nav-dropdown');
            dropdown.classList.toggle('open');
        });
    });
});
