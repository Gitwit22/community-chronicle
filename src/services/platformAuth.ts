import type {
  PlatformLaunchConsumeRequest,
  PlatformLaunchConsumeResponse,
} from "@/auth/types";
import { PLATFORM_API_BASE } from "@/lib/apiBase";
import { PROGRAM_SYSTEM_NAME } from "@/lib/programInfo";

/**
 * Exchanges a platform launch token for a Chronicle-local session token.
 * Token validity and app-access checks happen in the backend consume endpoint.
 */
export async function consumeLaunchToken(
  payload: PlatformLaunchConsumeRequest,
): Promise<PlatformLaunchConsumeResponse> {
  console.info("[chronicle-launch] consume started", {
    hasLaunchToken: Boolean(payload.launchToken),
    platformApiBase: PLATFORM_API_BASE,
  });

  const res = await fetch(`${PLATFORM_API_BASE}/api/community-chronicle/platform-auth/consume`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-app-partition": PROGRAM_SYSTEM_NAME,
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    token?: string;
    user?: PlatformLaunchConsumeResponse["user"];
    appInitState?: PlatformLaunchConsumeResponse["appInitState"];
  };

  if (!res.ok) {
    console.error("[chronicle-launch] consume failed", {
      status: res.status,
      error: data.error ?? "Launch validation failed.",
    });
    throw new Error(data.error ?? "Launch validation failed.");
  }

  if (!data.token || !data.user) {
    console.error("[chronicle-launch] consume invalid payload", {
      status: res.status,
      hasToken: Boolean(data.token),
      hasUser: Boolean(data.user),
    });
    throw new Error("Invalid launch consume response.");
  }

  console.info("[chronicle-launch] consume success", {
    status: res.status,
    userId: data.user.id,
    programDomain: data.user.programDomain,
  });

  return {
    token: data.token,
    user: data.user,
    appInitState: data.appInitState,
  };
}
