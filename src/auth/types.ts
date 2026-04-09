/**
 * Auth domain types for Community Chronicle.
 *
 * These interfaces mirror the contracts defined in the Cores repository at
 * packages/auth-core/src/domain/types.ts and packages/auth-core/src/ui/index.ts
 * (Gitwit22/Cores, main branch). They must not contain app-specific UI logic.
 *
 * Identity, org, and program context are kept together so this auth shape is
 * compatible with the broader Nxt Lvl suite (Community Chronicle, StreamLine,
 * Support Hub, etc.).
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type AuthRole = "uploader" | "reviewer" | "admin";

// ---------------------------------------------------------------------------
// Org / Program context
// ---------------------------------------------------------------------------

/**
 * Organizational context resolved after login.
 * Carried in the JWT payload and echoed by GET /api/auth/me.
 * When the application has not been initialized yet these may be undefined.
 */
export interface OrgContext {
  /** Unique identifier of the organization this user belongs to. */
  organizationId: string;
  /** Human-readable organization name (for display only). */
  organizationName: string;
  /**
   * Identifies which program/suite-app this session is scoped to.
   * e.g. "community-chronicle", "streamline", "support-hub"
   */
  programDomain: string;
}

// ---------------------------------------------------------------------------
// App initialization state
// ---------------------------------------------------------------------------

/**
 * Describes whether the application has been set up and whether the
 * authenticated user has a valid org assignment.
 *
 * The frontend uses this to decide which route to send the user to:
 *   - not_initialized  → /setup (no org/admin exists yet)
 *   - no_org           → /setup (user exists but has no org)
 *   - ready            → / (fully configured, proceed normally)
 */
export type AppInitState = "unknown" | "not_initialized" | "no_org" | "ready";

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/**
 * Canonical user identity returned by the auth API.
 * Maps to AuthUser in auth-core, extended with org/program context so
 * routing and access decisions can be made without extra round-trips.
 */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AuthRole;
  /** Present when the user belongs to an organization. */
  organizationId?: string;
  /** Human-readable org name for display. */
  organizationName?: string;
  /**
   * The suite program this session is scoped to.
   * Defaults to "community-chronicle" for direct Chronicle logins.
   */
  programDomain?: string;
  /**
   * How this user was authenticated into Chronicle.
   *  "platform" — authenticated via Suite handoff
   *  "local"    — registered/logged in directly inside Chronicle
   */
  identitySource?: "platform" | "local";
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Credentials submitted by a user attempting to log in.
 * Matches LoginCredentials in auth-core/domain/types.ts.
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * View-model for the login form UI.
 * Matches LoginViewModel in auth-core/src/ui/index.ts.
 */
export interface LoginViewModel {
  email: string;
  password: string;
  isSubmitting: boolean;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// /api/auth/me response
// ---------------------------------------------------------------------------

/**
 * Shape returned by GET /api/auth/me.
 * Carries full user context plus the app initialization state so the
 * frontend can make a single call to determine the correct starting route.
 */
export interface MeResponse {
  user: AuthUser;
  /** Whether the application has been initialized (org + admin user created). */
  appInitialized: boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Canonical error codes for auth-related failures.
 * Mirrors AuthErrorCode in auth-core/domain/types.ts.
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS",
  ACCOUNT_INACTIVE = "AUTH_ACCOUNT_INACTIVE",
  ACCOUNT_LOCKED = "AUTH_ACCOUNT_LOCKED",
  LOGIN_DISABLED = "AUTH_LOGIN_DISABLED",
  EMAIL_NOT_VERIFIED = "AUTH_EMAIL_NOT_VERIFIED",
  UNAUTHORIZED = "AUTH_UNAUTHORIZED",
  UNKNOWN = "AUTH_UNKNOWN",
}

/**
 * Structured error returned by auth operations.
 * Mirrors AuthError in auth-core/domain/types.ts.
 */
export interface AuthError {
  code: AuthErrorCode;
  message: string;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/**
 * Discriminated union result from the login use case.
 * Mirrors LoginResult in auth-core/domain/types.ts.
 * On success, appInitState indicates where the user should be routed.
 */
export type LoginResult =
  | { success: true; user: AuthUser; token: string; appInitState: AppInitState }
  | { success: false; error: AuthError };

// ---------------------------------------------------------------------------
// Platform launch consume
// ---------------------------------------------------------------------------

/** Request body for POST /api/platform-auth/consume. */
export interface PlatformLaunchConsumeRequest {
  launchToken: string;
}

/** Success payload from the Chronicle backend after platform validation. */
export interface PlatformLaunchConsumeResponse {
  token: string;
  user: AuthUser;
  appInitState?: AppInitState;
}

/** Result returned by frontend launch-consume flow. */
export type PlatformLaunchConsumeResult =
  | { success: true; user: AuthUser; token: string; appInitState: AppInitState }
  | { success: false; error: AuthError };
