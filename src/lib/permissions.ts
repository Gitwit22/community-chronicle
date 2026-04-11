/**
 * Permission helpers for the two-level admin model.
 *
 * Key rule: these checks are ALWAYS separate.
 *   canManageSuite       → requires platformRole === "suite_admin"
 *   canManageOrganization → requires membership.role === "owner" | "admin"
 *
 * An org admin does NOT gain suite admin access. Never merge these checks.
 */

import type { AuthUser } from "@/auth/types";
import type { OrganizationMembership, OrgRole } from "@/types/org";

// ---------------------------------------------------------------------------
// Suite-level checks
// ---------------------------------------------------------------------------

/** True only for users with the suite_admin platform role. */
export function isSuiteAdmin(user: AuthUser | null | undefined): boolean {
  return user?.platformRole === "suite_admin";
}

/** Alias — prefer this name in guard/conditional logic for clarity. */
export const canManageSuite = isSuiteAdmin;

// ---------------------------------------------------------------------------
// Org-level checks
// ---------------------------------------------------------------------------

/** True if the user is the organization owner. */
export function isOrgOwner(membership: OrganizationMembership | null | undefined): boolean {
  return membership?.role === "owner";
}

/**
 * True if the user has admin-level control within the organization.
 * Covers owner and admin roles.
 */
export function isOrgAdmin(membership: OrganizationMembership | null | undefined): boolean {
  const adminRoles: OrgRole[] = ["owner", "admin"];
  return membership != null && adminRoles.includes(membership.role);
}

/**
 * True if the user can manage organization settings (users, roles, programs).
 * Requires owner or admin membership role.
 *
 * This is intentionally separate from canManageSuite — org admin alone is
 * never sufficient to access suite-wide controls.
 */
export function canManageOrganization(
  membership: OrganizationMembership | null | undefined,
): boolean {
  return isOrgAdmin(membership);
}

// ---------------------------------------------------------------------------
// Program access checks
// ---------------------------------------------------------------------------

/**
 * Returns true if:
 *   1. The organization has the program enabled.
 *   2. The specific user also has access to that program within the org.
 *
 * Both layers must pass. This models the two-tier gating:
 *   org buys/enables a program → then assigns individual users.
 */
export function canAccessProgram(
  userId: string,
  orgPrograms: Array<{ programId: string; enabled: boolean }>,
  userPrograms: Array<{ userId: string; programId: string; enabled: boolean }>,
  programId: string,
): boolean {
  const orgHasProgram = orgPrograms.some((p) => p.programId === programId && p.enabled);
  if (!orgHasProgram) return false;

  const userAccess = userPrograms.find(
    (p) => p.userId === userId && p.programId === programId,
  );
  return userAccess?.enabled === true;
}

// ---------------------------------------------------------------------------
// Composite guard helpers (use in JSX conditionals)
// ---------------------------------------------------------------------------

/**
 * Whether to show the Settings section in the org portal nav.
 * Visible only to org owners and admins.
 */
export function showOrgSettings(
  membership: OrganizationMembership | null | undefined,
): boolean {
  return canManageOrganization(membership);
}

/**
 * Whether to show the Suite Admin section in the top-level nav.
 * Never shown to org admins unless they also hold suite_admin.
 */
export function showSuiteAdmin(user: AuthUser | null | undefined): boolean {
  return isSuiteAdmin(user);
}
