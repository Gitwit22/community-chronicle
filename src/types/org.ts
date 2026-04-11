/**
 * Organization and permission model types.
 *
 * These types cover the two-level admin model:
 *   - platformRole on AuthUser controls suite-wide access
 *   - OrganizationMembership.role controls access within a single org portal
 *
 * The two are strictly separate: org admin does NOT imply suite admin.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** Roles within a single organization. */
export type OrgRole = "owner" | "admin" | "manager" | "member" | "viewer";

/** Platform-wide roles, independent of any organization. */
export type PlatformRole = "suite_admin" | "user";

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  /** URL-safe identifier used in /org/:slug routes. */
  slug: string;
  ownerUserId: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export interface OrganizationMembership {
  id: string;
  userId: string;
  organizationId: string;
  /** Role within this organization only. */
  role: OrgRole;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

export interface Program {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Access control — org level
// ---------------------------------------------------------------------------

/** Controls which programs an organization has enabled. */
export interface OrganizationProgramAccess {
  id: string;
  organizationId: string;
  programId: string;
  programName?: string;
  programSlug?: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Access control — user level
// ---------------------------------------------------------------------------

/** Controls which programs a specific user inside an org can access. */
export interface UserProgramAccess {
  id: string;
  userId: string;
  organizationId: string;
  programId: string;
  programName?: string;
  programSlug?: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Org member list item
// ---------------------------------------------------------------------------

/** Member record as returned by the members list API. */
export interface OrgMember {
  userId: string;
  displayName: string;
  email: string;
  role: OrgRole;
  /** List of programIds this member has been granted access to. */
  programAccess: string[];
}

// ---------------------------------------------------------------------------
// Invitation
// ---------------------------------------------------------------------------

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface OrgInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrgRole;
  status: InvitationStatus;
  invitedByUserId: string;
  expiresAt?: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export interface MembershipResponse {
  membership: OrganizationMembership;
}

export interface OrgMembersResponse {
  members: OrgMember[];
}

export interface OrgProgramAccessResponse {
  programs: OrganizationProgramAccess[];
}

export interface UserProgramAccessResponse {
  programs: UserProgramAccess[];
}

export interface InvitationsResponse {
  invitations: OrgInvitation[];
}
