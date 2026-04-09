import type {
  PlatformLaunchConsumeRequest,
  PlatformLaunchConsumeResponse,
} from "@/auth/types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

/**
 * Exchanges a platform launch token for a Chronicle-local session token.
 * Token validity and app-access checks happen in the backend consume endpoint.
 */
export async function consumeLaunchToken(
  payload: PlatformLaunchConsumeRequest,
): Promise<PlatformLaunchConsumeResponse> {
  const res = await fetch(`${API_BASE}/platform-auth/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    token?: string;
    user?: PlatformLaunchConsumeResponse["user"];
    appInitState?: PlatformLaunchConsumeResponse["appInitState"];
  };

  if (!res.ok) {
    throw new Error(data.error ?? "Launch validation failed.");
  }

  if (!data.token || !data.user) {
    throw new Error("Invalid launch consume response.");
  }

  return {
    token: data.token,
    user: data.user,
    appInitState: data.appInitState,
  };
}
