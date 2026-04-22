// Canonical production API for Community Chronicle document workflows.
// Production API runs on Render. A branded API domain (api.nxtlvl.app) can
// be reintroduced later as an optional infra improvement once TLS/DNS is resolved.
const DEFAULT_HOSTED_API_BASE_URL = "https://community-chronicle.onrender.com/api";
const DEFAULT_HOSTED_PLATFORM_URL = "https://community-chronicle.onrender.com";

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1";
}

function getDefaultApiBaseUrl() {
  if (typeof window === "undefined") {
    return "/api";
  }

  const host = window.location.hostname.toLowerCase();
  if (isLocalHost(host)) {
    return "/api";
  }

  if (
    host === "nltops.com" ||
    host.endsWith(".nltops.com") ||
    host.endsWith(".ntlops.com") ||
    host.endsWith(".pages.dev") ||
    host.endsWith(".onrender.com")
  ) {
    return DEFAULT_HOSTED_API_BASE_URL;
  }

  return "/api";
}

export const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? getDefaultApiBaseUrl()).replace(/\/$/, "");

// Central platform API (nxt-lvl-api) — used for suite token exchange.
// Keep this aligned with API_BASE host unless explicitly overridden.
export const PLATFORM_API_BASE = ((import.meta.env.VITE_PLATFORM_API_URL as string | undefined) ?? DEFAULT_HOSTED_PLATFORM_URL).replace(/\/$/, "");
