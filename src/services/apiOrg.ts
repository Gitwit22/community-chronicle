/**
 * API service for organization management.
 *
 * All endpoints require a Bearer token. Org admin routes are enforced
 * server-side — the backend must verify membership before returning data.
 */

import { API_BASE } from "@/lib/apiBase";
import type {
  MembershipResponse,
  OrgMembersResponse,
  OrgProgramAccessResponse,
  UserProgramAccessResponse,
  InvitationsResponse,
  OrgRole,
  Organization,
} from "@/types/org";

// ---------------------------------------------------------------------------
// Shared fetch helper
// ---------------------------------------------------------------------------

async function orgFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const payload = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

/**
 * GET /api/org/:orgId/membership/me
 * Returns the current user's membership record for the given organization.
 */
export async function fetchMyOrgMembership(
  organizationId: string,
  token: string,
): Promise<MembershipResponse> {
  return orgFetch<MembershipResponse>(
    `/org/${organizationId}/membership/me`,
    token,
  );
}

/**
 * GET /api/org/:orgId/members
 * Returns all members of the organization. Requires org admin.
 */
export async function fetchOrgMembers(
  organizationId: string,
  token: string,
): Promise<OrgMembersResponse> {
  return orgFetch<OrgMembersResponse>(`/org/${organizationId}/members`, token);
}

/**
 * PATCH /api/org/:orgId/members/:userId/role
 * Update a member's org role. Requires org admin.
 */
export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: OrgRole,
  token: string,
): Promise<void> {
  await orgFetch(`/org/${organizationId}/members/${userId}/role`, token, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

/**
 * DELETE /api/org/:orgId/members/:userId
 * Remove a member from the organization. Requires org admin.
 */
export async function removeMember(
  organizationId: string,
  userId: string,
  token: string,
): Promise<void> {
  await orgFetch(`/org/${organizationId}/members/${userId}`, token, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Organization profile
// ---------------------------------------------------------------------------

/**
 * GET /api/org/:orgId
 * Fetch organization details.
 */
export async function fetchOrganization(
  organizationId: string,
  token: string,
): Promise<{ organization: Organization }> {
  return orgFetch<{ organization: Organization }>(`/org/${organizationId}`, token);
}

/**
 * GET /api/org/by-slug/:slug
 * Resolve organization by slug (for /org/:slug portal routes).
 */
export async function fetchOrgBySlug(
  slug: string,
  token: string,
): Promise<{ organization: Organization }> {
  return orgFetch<{ organization: Organization }>(
    `/org/by-slug/${slug}`,
    token,
  );
}

/**
 * PATCH /api/org/:orgId
 * Update organization profile fields. Requires org admin.
 */
export async function updateOrgProfile(
  organizationId: string,
  data: Partial<Pick<Organization, "name">>,
  token: string,
): Promise<{ organization: Organization }> {
  return orgFetch<{ organization: Organization }>(
    `/org/${organizationId}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

// ---------------------------------------------------------------------------
// Program access — org level
// ---------------------------------------------------------------------------

/**
 * GET /api/org/:orgId/programs
 * Returns which programs this organization has enabled. Requires org admin.
 */
export async function fetchOrgProgramAccess(
  organizationId: string,
  token: string,
): Promise<OrgProgramAccessResponse> {
  return orgFetch<OrgProgramAccessResponse>(
    `/org/${organizationId}/programs`,
    token,
  );
}

/**
 * PATCH /api/org/:orgId/programs/:programId
 * Enable or disable a program for the organization. Requires org admin.
 */
export async function updateOrgProgramAccess(
  organizationId: string,
  programId: string,
  enabled: boolean,
  token: string,
): Promise<void> {
  await orgFetch(`/org/${organizationId}/programs/${programId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

// ---------------------------------------------------------------------------
// Program access — user level
// ---------------------------------------------------------------------------

/**
 * GET /api/org/:orgId/members/:userId/programs
 * Returns which programs a specific user has access to within the org.
 */
export async function fetchUserProgramAccess(
  organizationId: string,
  userId: string,
  token: string,
): Promise<UserProgramAccessResponse> {
  return orgFetch<UserProgramAccessResponse>(
    `/org/${organizationId}/members/${userId}/programs`,
    token,
  );
}

/**
 * PATCH /api/org/:orgId/members/:userId/programs/:programId
 * Grant or revoke a program for a specific user within the org.
 */
export async function updateUserProgramAccess(
  organizationId: string,
  userId: string,
  programId: string,
  enabled: boolean,
  token: string,
): Promise<void> {
  await orgFetch(
    `/org/${organizationId}/members/${userId}/programs/${programId}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    },
  );
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

/**
 * GET /api/org/:orgId/invitations
 * List pending invitations. Requires org admin.
 */
export async function fetchOrgInvitations(
  organizationId: string,
  token: string,
): Promise<InvitationsResponse> {
  return orgFetch<InvitationsResponse>(
    `/org/${organizationId}/invitations`,
    token,
  );
}

/**
 * POST /api/org/:orgId/invitations
 * Send an invitation to an email address with a specified org role.
 */
export async function inviteOrgMember(
  organizationId: string,
  email: string,
  role: OrgRole,
  token: string,
): Promise<void> {
  await orgFetch(`/org/${organizationId}/invitations`, token, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

/**
 * DELETE /api/org/:orgId/invitations/:invitationId
 * Revoke a pending invitation. Requires org admin.
 */
export async function revokeInvitation(
  organizationId: string,
  invitationId: string,
  token: string,
): Promise<void> {
  await orgFetch(
    `/org/${organizationId}/invitations/${invitationId}`,
    token,
    { method: "DELETE" },
  );
}
