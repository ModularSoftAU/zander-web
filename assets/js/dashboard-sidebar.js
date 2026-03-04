document.addEventListener("DOMContentLoaded", function () {
  const navDropdownToggles = document.querySelectorAll(".nav-dropdown-toggle");

  navDropdownToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const dropdown = toggle.closest(".nav-dropdown");
      dropdown.classList.toggle("open");
    });
  });
});
