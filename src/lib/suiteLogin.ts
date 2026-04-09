import { PROGRAM_SYSTEM_NAME } from "@/lib/programInfo";

const SUITE_URL = (import.meta.env.VITE_SUITE_URL as string | undefined) ?? "";

/**
 * Builds the suite login URL with a next-app hint so users can be routed back
 * into the proper application after authentication.
 */
export function getSuiteLoginUrl(): string {
  try {
    const url = new URL("/login", SUITE_URL);
    url.searchParams.set("next", PROGRAM_SYSTEM_NAME);
    return url.toString();
  } catch {
    // Fallback keeps navigation inside app if suite URL is not configured.
    return "/landing";
  }
}
