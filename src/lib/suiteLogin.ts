import { PROGRAM_SYSTEM_NAME } from "@/lib/programInfo";

const SUITE_URL = (import.meta.env.VITE_SUITE_URL as string | undefined) ?? "";
const SUITE_LOGIN_PATH = (import.meta.env.VITE_SUITE_LOGIN_PATH as string | undefined) ?? "/?auth=signin";
const RETURN_PATH_KEY = "chronicle_post_auth_return_path";
const SUITE_HOST_PRIMARY = "nltops.com";
const SUITE_HOST_FALLBACK = "ntlops.com";

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function resolveSuiteBaseUrl(): string {
  if (SUITE_URL) return SUITE_URL;

  const host = window.location.hostname.toLowerCase();

  if (isLocalhost(host)) {
    return "http://localhost:3000";
  }

  if (host === SUITE_HOST_PRIMARY || host.endsWith(`.${SUITE_HOST_PRIMARY}`)) {
    return `https://${SUITE_HOST_PRIMARY}`;
  }

  if (host === SUITE_HOST_FALLBACK || host.endsWith(`.${SUITE_HOST_FALLBACK}`)) {
    return `https://${SUITE_HOST_FALLBACK}`;
  }

  return `https://${SUITE_HOST_FALLBACK}`;
}

function normalizeReturnPath(value?: string): string | undefined {
  if (!value) return undefined;

  try {
    const currentOrigin = window.location.origin;
    const asUrl = new URL(value, currentOrigin);
    if (asUrl.origin !== currentOrigin) {
      return undefined;
    }
    return `${asUrl.pathname}${asUrl.search}${asUrl.hash}`;
  } catch {
    return undefined;
  }
}

/**
 * Builds the suite login URL with a next-app hint so users can be routed back
 * into the proper application after authentication.
 */
export function getSuiteLoginUrl(returnTo?: string): string {
  const normalizedReturnPath = normalizeReturnPath(returnTo);
  const suiteBaseUrl = resolveSuiteBaseUrl();

  try {
    const url = new URL(SUITE_LOGIN_PATH, suiteBaseUrl);
    url.searchParams.set("next", PROGRAM_SYSTEM_NAME);
    if (normalizedReturnPath) {
      url.searchParams.set("returnTo", normalizedReturnPath);
    }
    return url.toString();
  } catch {
    return `https://${SUITE_HOST_FALLBACK}/?auth=signin&next=${encodeURIComponent(PROGRAM_SYSTEM_NAME)}`;
  }
}

export function rememberPostAuthReturnPath(returnTo?: string): void {
  const normalizedReturnPath = normalizeReturnPath(returnTo);
  if (!normalizedReturnPath || normalizedReturnPath === "/launch") {
    sessionStorage.removeItem(RETURN_PATH_KEY);
    return;
  }
  sessionStorage.setItem(RETURN_PATH_KEY, normalizedReturnPath);
}

export function consumePostAuthReturnPath(): string | null {
  const stored = sessionStorage.getItem(RETURN_PATH_KEY);
  sessionStorage.removeItem(RETURN_PATH_KEY);
  return normalizeReturnPath(stored) ?? null;
}
