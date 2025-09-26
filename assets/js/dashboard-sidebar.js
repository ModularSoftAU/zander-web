document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("dashboardSidebar");
    if (!sidebar) {
        return;
    }

    const navDropdownToggles = sidebar.querySelectorAll('.nav-dropdown-toggle');

    navDropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', (event) => {
            event.preventDefault();
            const dropdown = toggle.closest('.nav-dropdown');
            dropdown?.classList.toggle('open');
        });
    });

    if (typeof bootstrap !== 'undefined' && sidebar.classList.contains('collapse')) {
        const collapseInstance = bootstrap.Collapse.getOrCreateInstance(sidebar, { toggle: false });

        sidebar.querySelectorAll('.nav-link').forEach(link => {
            if (!link.classList.contains('nav-dropdown-toggle')) {
                link.addEventListener('click', () => {
                    if (window.innerWidth < 992) {
                        collapseInstance.hide();
                    }
                });
            }
        });
    }
});
