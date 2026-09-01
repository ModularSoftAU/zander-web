/**
 * CSRF token distributor.
 *
 * The server injects <meta name="csrf-token" content="..."> into every HTML
 * response and enforces the token on POST/PUT/PATCH/DELETE for the
 * session-cookie-authed site + dashboard routes (see @fastify/csrf-protection
 * registration in app.js). This script makes sure every outbound state-changing
 * request carries the token:
 *
 *   - native <form method="post"> submits get a hidden _csrf input
 *   - window.fetch same-origin non-GET calls get an x-csrf-token header
 *   - jQuery.ajax same-origin non-GET calls get an x-csrf-token header
 *
 * Bearer-token API calls are cross-scope on the server and are never blocked,
 * so an extra header on them is harmless.
 */
(function () {
  "use strict";

  var meta = document.querySelector('meta[name="csrf-token"]');
  if (!meta) return;
  var token = meta.getAttribute("content") || "";
  if (!token) return;

  var SAFE = /^(GET|HEAD|OPTIONS|TRACE)$/i;

  function stampForm(form) {
    if (!form || form.tagName !== "FORM") return;
    var method = (form.getAttribute("method") || "get").toUpperCase();
    if (SAFE.test(method)) return;
    if (form.querySelector('input[name="_csrf"]')) return;
    var input = document.createElement("input");
    input.type = "hidden";
    input.name = "_csrf";
    input.value = token;
    form.appendChild(input);
  }

  function stampAllForms() {
    var forms = document.getElementsByTagName("form");
    for (var i = 0; i < forms.length; i++) stampForm(forms[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", stampAllForms);
  } else {
    stampAllForms();
  }

  // Catch forms added after load, and any form whose submit fires before the
  // DOMContentLoaded sweep.
  document.addEventListener(
    "submit",
    function (e) {
      stampForm(e.target);
    },
    true
  );

  function sameOrigin(url) {
    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch (_) {
      return true; // relative URL
    }
  }

  // Patch window.fetch
  if (typeof window.fetch === "function") {
    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      init = init || {};
      var url = typeof input === "string" ? input : input && input.url;
      var method = (
        init.method ||
        (typeof input === "object" && input && input.method) ||
        "GET"
      ).toUpperCase();
      if (!SAFE.test(method) && sameOrigin(url)) {
        var headers = new Headers(init.headers || (typeof input === "object" && input && input.headers) || {});
        if (!headers.has("x-csrf-token")) headers.set("x-csrf-token", token);
        init.headers = headers;
      }
      return originalFetch.call(this, input, init);
    };
  }

  // Patch jQuery.ajax (used by Summernote and various dashboard scripts)
  if (window.jQuery) {
    window.jQuery(document).ajaxSend(function (event, xhr, settings) {
      if (settings.crossDomain) return;
      if (SAFE.test(settings.type || "GET")) return;
      xhr.setRequestHeader("x-csrf-token", token);
    });
  }
})();
