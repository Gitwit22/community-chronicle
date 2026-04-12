import { PROGRAM_SYSTEM_NAME } from "@/lib/programInfo";

/** Key used to store the JWT in localStorage */
export const AUTH_TOKEN_KEY = "chronicle_auth_token";
const LEGACY_AUTH_TOKEN_KEY = "cc_auth_token";

/** Returns the stored auth token, or null */
export function getStoredToken(): string | null {
  try {
    const currentToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (currentToken) {
      return currentToken;
    }

    // Backward compatibility: migrate token stored under old key.
    const legacyToken = localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
    if (legacyToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, legacyToken);
      localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
      return legacyToken;
    }

    return null;
  } catch {
    return null;
  }
}

/** Persists the auth token */
export function setStoredToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/** Clears the stored token */
export function clearStoredToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

/** Returns Authorization header value if a token is stored, otherwise empty object */
export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    "x-app-partition": PROGRAM_SYSTEM_NAME,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
