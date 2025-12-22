(() => {
  const notificationEndpoint = "/notifications/summary";
  const pollIntervalMs = 60000;

  const canUseNotifications = () => "Notification" in window;
  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

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
    await handleUpdates();
    setInterval(handleUpdates, pollIntervalMs);
  };

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
