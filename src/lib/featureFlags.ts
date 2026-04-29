/**
 * Feature flag utilities.
 *
 * Values are read once at module load from Vite env.
 * Server-side the same flags are controlled via process.env without the VITE_ prefix.
 */

export const PAGE_FIRST_INTAKE_ENABLED =
  import.meta.env.VITE_COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE === "true";
