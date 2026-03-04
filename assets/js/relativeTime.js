/**
 * Relative Time Formatter
 * Converts UTC timestamps to user's local timezone and displays relative time
 * Usage: Add data-relative-time="ISO_DATE_STRING" to any element
 *        Optionally add data-relative-format="relative|datetime|both" (default: relative)
 */
(function () {
  "use strict";

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  /**
   * Format a date as relative time (e.g., "5 minutes ago")
   */
  function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const absDiff = Math.abs(diff);
    const isFuture = diff < 0;
    const suffix = isFuture ? "from now" : "ago";

    if (absDiff < MINUTE) {
      return "just now";
    } else if (absDiff < HOUR) {
      const minutes = Math.floor(absDiff / MINUTE);
      return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ${suffix}`;
    } else if (absDiff < DAY) {
      const hours = Math.floor(absDiff / HOUR);
      return `${hours} ${hours === 1 ? "hour" : "hours"} ${suffix}`;
    } else if (absDiff < WEEK) {
      const days = Math.floor(absDiff / DAY);
      if (days === 1) {
        return isFuture ? "tomorrow" : "yesterday";
      }
      return `${days} days ${suffix}`;
    } else if (absDiff < MONTH) {
      const weeks = Math.floor(absDiff / WEEK);
      return `${weeks} ${weeks === 1 ? "week" : "weeks"} ${suffix}`;
    } else if (absDiff < YEAR) {
      const months = Math.floor(absDiff / MONTH);
      return `${months} ${months === 1 ? "month" : "months"} ${suffix}`;
    } else {
      const years = Math.floor(absDiff / YEAR);
      return `${years} ${years === 1 ? "year" : "years"} ${suffix}`;
    }
  }

  /**
   * Format a date as a localized datetime string
   */
  function formatLocalDateTime(date, options) {
    const defaultOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };
    return date.toLocaleString(undefined, options || defaultOptions);
  }

  /**
   * Format a date for display based on the format type
   */
  function formatDate(date, format) {
    switch (format) {
      case "datetime":
        return formatLocalDateTime(date);
      case "both":
        return `${formatRelativeTime(date)} (${formatLocalDateTime(date)})`;
      case "date":
        return date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      case "time":
        return date.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      case "full":
        return date.toLocaleString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      case "relative":
      default:
        return formatRelativeTime(date);
    }
  }

  /**
   * Update all elements with relative time
   */
  function updateRelativeTimes() {
    const elements = document.querySelectorAll("[data-relative-time]");

    elements.forEach(function (element) {
      const timestamp = element.getAttribute("data-relative-time");
      if (!timestamp) return;

      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return;

      const format = element.getAttribute("data-relative-format") || "relative";
      const formatted = formatDate(date, format);

      // Set the text content
      element.textContent = formatted;

      // Set a tooltip with the full local datetime if showing relative time
      if (format === "relative" && !element.hasAttribute("data-no-tooltip")) {
        element.setAttribute(
          "title",
          formatLocalDateTime(date, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }),
        );
      }
    });

    // Handle edited indicators with tooltips
    const editedElements = document.querySelectorAll("[data-edited-time]");
    editedElements.forEach(function (element) {
      const timestamp = element.getAttribute("data-edited-time");
      if (!timestamp) return;

      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return;

      const formattedDate = formatLocalDateTime(date, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      element.setAttribute("title", "Edited " + formattedDate);
      element.setAttribute("data-bs-toggle", "tooltip");
      element.style.cursor = "help";
    });
  }

  /**
   * Initialize relative time formatting
   */
  function init() {
    // Initial update
    updateRelativeTimes();

    // Update every minute for relative times
    setInterval(updateRelativeTimes, 60 * 1000);

    // Also update when the page becomes visible again
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        updateRelativeTimes();
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Export for manual use
  window.RelativeTime = {
    format: formatDate,
    formatRelative: formatRelativeTime,
    formatDateTime: formatLocalDateTime,
    update: updateRelativeTimes,
  };
})();
