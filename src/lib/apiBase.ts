const DEFAULT_HOSTED_API_BASE_URL = "https://community-chronicle.onrender.com/api";

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

  if (host === "nltops.com" || host.endsWith(".nltops.com") || host.endsWith(".ntlops.com") || host.endsWith(".pages.dev")) {
    return DEFAULT_HOSTED_API_BASE_URL;
  }

  return "/api";
}

export const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? getDefaultApiBaseUrl()).replace(/\/$/, "");

// Central platform API (nxt-lvl-api) — used for suite token exchange.
// Separate from API_BASE which points to the CC-specific document backend.
export const PLATFORM_API_BASE = ((import.meta.env.VITE_PLATFORM_API_URL as string | undefined) ?? "https://api.ntlops.com").replace(/\/$/, "");
