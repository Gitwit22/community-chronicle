/**
 * Auth domain types for Community Chronicle.
 *
 * These interfaces mirror the contracts defined in the Cores repository at
 * packages/auth-core/src/domain/types.ts and packages/auth-core/src/ui/index.ts
 * (Gitwit22/Cores, main branch). They must not contain app-specific UI logic.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type AuthRole = "uploader" | "reviewer" | "admin";

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/**
 * Canonical user identity returned by the auth API.
 * Maps to AuthUser in auth-core, scoped to the fields this app exposes.
 */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: AuthRole;
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
 */
export type LoginResult =
  | { success: true; user: AuthUser; token: string }
  | { success: false; error: AuthError };
