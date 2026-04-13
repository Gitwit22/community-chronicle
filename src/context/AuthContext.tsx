import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { AuthUser, AppInitState, MeResponse } from "@/auth/types";
import { API_BASE } from "@/lib/apiBase";
import { PROGRAM_SYSTEM_NAME } from "@/lib/programInfo";

const TOKEN_KEY = "chronicle_auth_token";
const USER_KEY = "chronicle_auth_user";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  organizationId: string | null;
  organizationName: string | null;
  programDomain: string | null;
  role: AuthUser["role"] | null;
  platformRole: AuthUser["platformRole"];
  appInitState: AppInitState;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

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
    platformRole: user?.platformRole,
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

  const hydrateFromServer = useCallback(async (storedToken: string): Promise<void> => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
          "x-app-partition": PROGRAM_SYSTEM_NAME,
        },
      });
      if (!res.ok) {
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
      // Network unavailable — keep existing state
    }
  }, []);

  // Restore session from localStorage on mount, then verify with server.
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUserRaw = localStorage.getItem(USER_KEY);

    if (!storedToken || !storedUserRaw) {
      setIsLoading(false);
      return;
    }

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

    hydrateFromServer(storedToken).finally(() => setIsLoading(false));
  }, [hydrateFromServer]);

  const refreshSession = useCallback(async () => {
    if (!token) return;
    await hydrateFromServer(token);
  }, [token, hydrateFromServer]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-partition": PROGRAM_SYSTEM_NAME,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        accessToken?: string;
        user?: AuthUser;
        appInitState?: AppInitState;
        error?: string;
      };

      if (!res.ok) {
        return { success: false, error: data.error ?? "Invalid credentials." };
      }

      const sessionToken = data.token ?? data.accessToken ?? "";
      const sessionUser = data.user;

      if (!sessionToken || !sessionUser) {
        return { success: false, error: "Unexpected response from server." };
      }

      const resolvedInitState: AppInitState = data.appInitState ?? initStateFromUser(sessionUser);
      setToken(sessionToken);
      setUser(sessionUser);
      setAppInitState(resolvedInitState);
      persistSession(sessionToken, sessionUser);

      return { success: true };
    } catch {
      return { success: false, error: "Unable to reach the server." };
    }
  }, []);

  const logout = () => {
    setUser(null);
    setToken(null);
    setAppInitState("unknown");
    clearStorage();
    window.location.replace("/login");
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
