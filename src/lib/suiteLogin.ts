import { PROGRAM_SYSTEM_NAME } from "@/lib/programInfo";

const SUITE_URL = (import.meta.env.VITE_SUITE_URL as string | undefined) ?? "";
const RETURN_PATH_KEY = "chronicle_post_auth_return_path";

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

  try {
    const url = new URL("/login", SUITE_URL);
    url.searchParams.set("next", PROGRAM_SYSTEM_NAME);
    if (normalizedReturnPath) {
      url.searchParams.set("returnTo", normalizedReturnPath);
    }
    return url.toString();
  } catch {
    // Fallback keeps navigation inside app if suite URL is not configured.
    return "/landing";
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
