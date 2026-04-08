import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { AuthUser, LoginCredentials, LoginResult, AppInitState, MeResponse } from "@/auth/types";
import { AuthErrorCode } from "@/auth/types";

// When VITE_API_URL is not set, requests are made to relative paths (same origin).
// This is correct for production deployments where the API is served from the same host,
// and for local dev when Vite's proxy is configured. Set VITE_API_URL explicitly to
// point at a different host (e.g. http://localhost:4000 during split dev).
const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

const TOKEN_KEY = "chronicle_auth_token";
const USER_KEY = "chronicle_auth_user";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  /** The authenticated user with identity + org context. */
  user: AuthUser | null;
  /** The raw JWT token. */
  token: string | null;
  /** Org/tenant fields surfaced directly for convenience. */
  organizationId: string | null;
  organizationName: string | null;
  programDomain: string | null;
  role: AuthUser["role"] | null;
  /**
   * Describes whether the app has been initialized and whether the user
   * has a valid org assignment. Used by ProtectedRoute to decide routing.
   *
   * "unknown"          – still hydrating from storage / verifying with server
   * "not_initialized"  – no org/admin has been set up yet → go to /setup
   * "no_org"           – user exists but has no org assignment → go to /setup
   * "ready"            – fully configured, proceed to the archive
   */
  appInitState: AppInitState;
  /** True while the initial session hydration is in progress. */
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  logout: () => void;
  /** Re-validate the session against GET /api/auth/me and refresh context. */
  refreshSession: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function persistSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function orgFieldsFromUser(user: AuthUser | null) {
  return {
    organizationId: user?.organizationId ?? null,
    organizationName: user?.organizationName ?? null,
    programDomain: user?.programDomain ?? null,
    role: user?.role ?? null,
  };
}

function initStateFromUser(user: AuthUser | null): AppInitState {
  if (!user) return "unknown";
  if (!user.organizationId) return "no_org";
  return "ready";
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [appInitState, setAppInitState] = useState<AppInitState>("unknown");
  const [isLoading, setIsLoading] = useState(true);

  /** Call GET /api/auth/me with a given token and update all state. */
  const hydrateFromServer = useCallback(async (storedToken: string): Promise<void> => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (!res.ok) {
        // Token is invalid/expired — clear everything
        clearStorage();
        setToken(null);
        setUser(null);
        setAppInitState("unknown");
        return;
      }
      const data = (await res.json()) as MeResponse & { appInitState?: AppInitState };
      const freshUser = data.user;
      const freshInitState: AppInitState =
        (data as { appInitState?: AppInitState }).appInitState ?? initStateFromUser(freshUser);
      setUser(freshUser);
      setAppInitState(freshInitState);
      persistSession(storedToken, freshUser);
    } catch {
      // Network unavailable — trust the cached user for now, but mark state
      // as unknown so ProtectedRoute can decide conservatively.
      setAppInitState(initStateFromUser(user));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore session from localStorage on mount, then validate with server
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUserRaw = localStorage.getItem(USER_KEY);

    if (!storedToken || !storedUserRaw) {
      setIsLoading(false);
      return;
    }

    // Optimistically restore from cache so the UI isn't blank
    try {
      const cached = JSON.parse(storedUserRaw) as AuthUser;
      setToken(storedToken);
      setUser(cached);
      setAppInitState(initStateFromUser(cached));
    } catch {
      clearStorage();
      setIsLoading(false);
      return;
    }

    // Then verify with the server in the background
    hydrateFromServer(storedToken).finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshSession = useCallback(async () => {
    if (!token) return;
    await hydrateFromServer(token);
  }, [token, hydrateFromServer]);

  const login = async (credentials: LoginCredentials): Promise<LoginResult> => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return {
          success: false,
          error: {
            code:
              res.status === 401
                ? AuthErrorCode.INVALID_CREDENTIALS
                : AuthErrorCode.UNKNOWN,
            message: data.error ?? "Login failed. Please try again.",
          },
        };
      }

      const data = (await res.json()) as {
        token: string;
        user: AuthUser;
        appInitState?: AppInitState;
      };

      const resolvedInitState: AppInitState =
        data.appInitState ?? initStateFromUser(data.user);

      setToken(data.token);
      setUser(data.user);
      setAppInitState(resolvedInitState);
      persistSession(data.token, data.user);

      return {
        success: true,
        user: data.user,
        token: data.token,
        appInitState: resolvedInitState,
      };
    } catch {
      return {
        success: false,
        error: {
          code: AuthErrorCode.UNKNOWN,
          message: "Unable to reach the server. Please try again.",
        },
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAppInitState("unknown");
    clearStorage();
  };

  const derived = orgFieldsFromUser(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        ...derived,
        appInitState,
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
