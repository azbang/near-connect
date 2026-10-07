// Telegram Mini App bridge. Inside a Mini App the webview blocks window.open
// (the call comes from a postMessage handler, not a user gesture) and never routes custom schemes,
// so links have to go through Telegram itself. The dApp may not load telegram-web-app.js,
// so we fall back to the raw bridge: https://core.telegram.org/api/web-events

const getWebApp = () => {
  const tgapp = (window as any)?.Telegram?.WebApp;
  // Outside of Telegram the SDK still exists but reports "unknown" platform
  if (!tgapp || !tgapp.platform || tgapp.platform === "unknown") return null;
  return tgapp;
};

const hasLaunchParams = () => {
  try {
    if (location.hash.includes("tgWebAppData")) return true;
    return !!sessionStorage.getItem("__telegram__initParams");
  } catch {
    return false;
  }
};

export const isTelegramMiniApp = () => {
  if (typeof window === "undefined") return false;
  return !!getWebApp() || !!(window as any).TelegramWebviewProxy || hasLaunchParams();
};

const postEvent = (eventType: string, eventData: object) => {
  const proxy = (window as any).TelegramWebviewProxy;
  if (proxy?.postEvent) return proxy.postEvent(eventType, JSON.stringify(eventData)); // iOS, Android

  const external = (window as any).external;
  if (external && "notify" in external) return external.notify(JSON.stringify({ eventType, eventData })); // Desktop

  if (window.parent !== window) {
    window.parent.postMessage(JSON.stringify({ eventType, eventData }), "https://web.telegram.org"); // Web
  }
};

export const openTelegramLink = (url: URL) => {
  const tgapp = getWebApp();
  if (tgapp) return tgapp.openTelegramLink(url.toString());
  postEvent("web_app_open_tg_link", { path_full: url.pathname + url.search });
};

export const openExternalLink = (url: URL) => {
  const tgapp = getWebApp();
  if (tgapp) return tgapp.openLink(url.toString());
  postEvent("web_app_open_link", { url: url.toString() });
};
