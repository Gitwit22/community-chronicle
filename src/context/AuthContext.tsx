import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type {
  AuthUser,
  AppInitState,
  MeResponse,
  PlatformLaunchConsumeResult,
} from "@/auth/types";
import { AuthErrorCode } from "@/auth/types";
import { consumeLaunchToken } from "@/services/platformAuth";
import { API_BASE } from "@/lib/apiBase";

// VITE_API_BASE_URL should point to the shared platform backend API prefix,
// for example: https://nxt-lvl-api.example.com/api.
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
  consumePlatformLaunch: (launchToken: string) => Promise<PlatformLaunchConsumeResult>;
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
  console.info("[chronicle-launch] session persisted", {
    userId: user.id,
    organizationId: user.organizationId,
    programDomain: user.programDomain,
    tokenStored: token.length > 0,
  });
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

function applySession(
  sessionToken: string,
  sessionUser: AuthUser,
  sessionInitState: AppInitState | undefined,
  setToken: (value: string | null) => void,
  setUser: (value: AuthUser | null) => void,
  setAppInitState: (value: AppInitState) => void,
) {
  const resolvedInitState: AppInitState = sessionInitState ?? initStateFromUser(sessionUser);
  setToken(sessionToken);
  setUser(sessionUser);
  setAppInitState(resolvedInitState);
  persistSession(sessionToken, sessionUser);
  return resolvedInitState;
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
      console.info("[chronicle-launch] refresh session started", {
        apiBase: API_BASE,
      });
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      if (!res.ok) {
        console.warn("[chronicle-launch] refresh session failed", {
          status: res.status,
        });
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
      console.info("[chronicle-launch] refresh session success", {
        userId: freshUser.id,
        programDomain: freshUser.programDomain,
      });
    } catch {
      // Network unavailable — keep existing state unchanged, the user will see
      // whatever was last persisted. The init state remains as resolved from the
      // cached user (set before this call) so routing still works offline.
      console.warn("[chronicle-launch] refresh session skipped due to network error");
    }
  }, []);

  // Restore session from localStorage on mount, then validate with server.
  // Also handles platform launch tokens passed as ?token= URL params.
  useEffect(() => {
    // Check for a platform launch token in the URL first
    const params = new URLSearchParams(window.location.search);
    const launchToken = params.get("token");

    if (launchToken) {
      // Remove the token from the URL immediately so it isn't leaked via history or bookmarks
      params.delete("token");
      const newSearch = params.toString();
      const cleanUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState(null, "", cleanUrl);

      // Exchange the launch token for a Chronicle session via the platform API
      consumeLaunchToken({ launchToken })
        .then((data) => {
          applySession(data.token, data.user, data.appInitState, setToken, setUser, setAppInitState);
        })
        .catch(() => {
          // Token exchange failed — fall through to normal storage check below
        })
        .finally(() => setIsLoading(false));
      return;
    }

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
  }, [hydrateFromServer]);

  const refreshSession = useCallback(async () => {
    if (!token) return;
    await hydrateFromServer(token);
  }, [token, hydrateFromServer]);

  const consumePlatformLaunch = useCallback(
    async (launchToken: string): Promise<PlatformLaunchConsumeResult> => {
      if (!launchToken.trim()) {
        console.error("[chronicle-launch] consume aborted: token missing");
        return {
          success: false,
          error: {
            code: AuthErrorCode.UNAUTHORIZED,
            message: "Launch token is required.",
          },
        };
      }

      try {
        const data = await consumeLaunchToken({ launchToken: launchToken.trim() });
        const resolvedInitState = applySession(
          data.token,
          data.user,
          data.appInitState,
          setToken,
          setUser,
          setAppInitState,
        );
        console.info("[chronicle-launch] auth state after consume", {
          userId: data.user.id,
          organizationId: data.user.organizationId,
          programDomain: data.user.programDomain,
          appInitState: resolvedInitState,
        });
        return {
          success: true,
          user: data.user,
          token: data.token,
          appInitState: resolvedInitState,
        };
      } catch (error) {
        clearStorage();
        setToken(null);
        setUser(null);
        setAppInitState("unknown");

        const message = error instanceof Error ? error.message : "Launch validation failed.";
        console.error("[chronicle-launch] consume failed in auth context", {
          reason: message,
        });
        return {
          success: false,
          error: {
            code: AuthErrorCode.UNAUTHORIZED,
            message,
          },
        };
      }
    },
    [],
  );

  const logout = () => {
    setUser(null);
    setToken(null);
    setAppInitState("unknown");
    clearStorage();
    window.location.replace("/landing");
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
        consumePlatformLaunch,
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
