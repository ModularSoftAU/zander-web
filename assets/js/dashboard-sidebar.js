document.addEventListener("DOMContentLoaded", function (event) {
  const sidebar = document.querySelector(".sidebar");
  const navDropdownToggles = document.querySelectorAll(".nav-dropdown-toggle");

  navDropdownToggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const dropdown = toggle.closest(".nav-dropdown");
      dropdown.classList.toggle("open");
    });
  });
});
