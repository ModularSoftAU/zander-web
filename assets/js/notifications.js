(() => {
  const notificationEndpoint = "/notifications/summary";
  const pollIntervalMs = 60000;

  const canUseNotifications = () => "Notification" in window;
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const installPromptKey = "installPromptDismissed";
  let deferredInstallPrompt = null;
  const isAuthenticated = () =>
    document.body?.dataset?.authenticated === "true";

  const shouldRequestPermission = () => {
    if (!canUseNotifications()) return false;
    if (Notification.permission !== "default") return false;
    return isStandalone();
  };

  const requestPermissionIfNeeded = async () => {
    if (!shouldRequestPermission()) return;
    const hasPrompted = localStorage.getItem("notificationsPermissionPrompted");
    if (hasPrompted) return;

    localStorage.setItem("notificationsPermissionPrompted", "true");
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.warn("Notification permission request failed", error);
    }
  };

  const maybeShowPermissionBanner = () => {
    if (!canUseNotifications()) return;
    if (!isAuthenticated()) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("notificationsBannerDismissed")) return;
    if (document.querySelector(".notification-permission-banner")) return;

    const banner = document.createElement("div");
    banner.className = "alert alert-info notification-permission-banner";
    banner.style.position = "sticky";
    banner.style.top = "0";
    banner.style.zIndex = "1030";
    banner.style.marginBottom = "0";
    banner.innerHTML = `
      <div class="container d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>Enable notifications to receive updates on your device.</div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-primary" data-action="enable">Enable</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-action="dismiss">Not now</button>
        </div>
      </div>
    `;

    banner.addEventListener("click", async (event) => {
      const action = event.target?.getAttribute?.("data-action");
      if (!action) return;

      if (action === "dismiss") {
        localStorage.setItem("notificationsBannerDismissed", "true");
        banner.remove();
        return;
      }

      if (action === "enable") {
        try {
          const permission = await Notification.requestPermission();
          localStorage.setItem("notificationsPermissionPrompted", "true");
          if (permission !== "default") {
            banner.remove();
          }
        } catch (error) {
          console.warn("Notification permission request failed", error);
        }
      }
    });

    document.body.prepend(banner);
  };

  const showInstallBanner = () => {
    if (isStandalone()) return;
    if (!deferredInstallPrompt) return;
    if (localStorage.getItem(installPromptKey)) return;
    if (document.querySelector(".install-app-banner")) return;

    const banner = document.createElement("div");
    banner.className = "alert alert-info install-app-banner";
    banner.style.position = "sticky";
    banner.style.top = "0";
    banner.style.zIndex = "1030";
    banner.style.marginBottom = "0";
    banner.innerHTML = `
      <div class="container d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div>Install the app for quicker access and notifications.</div>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-primary" data-action="install">Install</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-action="dismiss">Not now</button>
        </div>
      </div>
    `;

    banner.addEventListener("click", async (event) => {
      const action = event.target?.getAttribute?.("data-action");
      if (!action) return;

      if (action === "dismiss") {
        localStorage.setItem(installPromptKey, "true");
        banner.remove();
        return;
      }

      if (action === "install" && deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        try {
          await deferredInstallPrompt.userChoice;
        } finally {
          deferredInstallPrompt = null;
          banner.remove();
        }
      }
    });

    document.body.prepend(banner);
  };

  const getLastSeenId = () => Number(localStorage.getItem("lastNotificationId") || 0);
  const setLastSeenId = (notificationId) => {
    localStorage.setItem("lastNotificationId", String(notificationId));
  };

  const fetchSummary = async () => {
    const response = await fetch(notificationEndpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      return null;
    }
    return response.json();
  };

  const showNotification = async (notification) => {
    if (!canUseNotifications()) return;
    if (Notification.permission !== "granted") return;

    const registration = await navigator.serviceWorker.getRegistration();
    const data = { url: notification.url || "/notifications" };
    const options = {
      body: notification.message,
      data,
      icon: "/images/siteLogo.png",
      badge: "/images/siteLogo.png",
    };

    if (registration) {
      await registration.showNotification(notification.title, options);
    } else {
      const systemNotification = new Notification(notification.title, options);
      systemNotification.onclick = () => {
        window.location.href = data.url;
      };
    }
  };

  const handleUpdates = async () => {
    const summary = await fetchSummary();
    if (!summary || !Array.isArray(summary.items)) return;

    const lastSeenId = getLastSeenId();
    const newNotifications = summary.items
      .filter((item) => Number(item.notificationId) > lastSeenId)
      .sort((a, b) => Number(a.notificationId) - Number(b.notificationId));

    for (const notification of newNotifications) {
      await showNotification(notification);
    }

    if (summary.items.length) {
      const newestId = Math.max(...summary.items.map((item) => Number(item.notificationId)));
      if (newestId > lastSeenId) {
        setLastSeenId(newestId);
      }
    }
  };

  const startPolling = async () => {
    await requestPermissionIfNeeded();
    maybeShowPermissionBanner();
    showInstallBanner();
    await handleUpdates();
    setInterval(handleUpdates, pollIntervalMs);
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallBanner();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Failed to register service worker", error);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startPolling);
  } else {
    startPolling();
  }
})();
