/**
 * OrgContext — provides the current user's organization membership and
 * allowed programs for the organization portal.
 *
 * Resolves membership by calling GET /api/org/:orgId/membership/me once
 * the auth session is ready. All downstream guards and nav items consume
 * this context instead of making their own API calls.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchMyOrgMembership } from "@/services/apiOrg";
import { canManageOrganization, isOrgOwner } from "@/lib/permissions";
import type { OrganizationMembership, OrganizationProgramAccess } from "@/types/org";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface OrgContextValue {
  /** Current user's membership record in the active organization. */
  membership: OrganizationMembership | null;
  /** Programs this organization has enabled (org-level gate). */
  orgPrograms: OrganizationProgramAccess[];
  /** True while membership is being fetched. */
  isLoading: boolean;
  /** True if the current user can manage this organization (owner or admin). */
  canManage: boolean;
  /** True if the current user is the organization owner. */
  isOwner: boolean;
  /** Re-fetch membership (call after role changes). */
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OrgContext = createContext<OrgContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, token, organizationId, appInitState } = useAuth();

  const [membership, setMembership] = useState<OrganizationMembership | null>(null);
  const [orgPrograms] = useState<OrganizationProgramAccess[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMembership = useCallback(async () => {
    if (!token || !organizationId || appInitState !== "ready") return;

    setIsLoading(true);
    try {
      const data = await fetchMyOrgMembership(organizationId, token);
      setMembership(data.membership);
    } catch (err) {
      // Membership not found or network error — user may have standard access
      console.warn("[org-context] could not load membership", err);
      setMembership(null);
    } finally {
      setIsLoading(false);
    }
  }, [token, organizationId, appInitState]);

  useEffect(() => {
    if (appInitState === "ready" && user && token && organizationId) {
      void loadMembership();
    } else {
      setMembership(null);
    }
  }, [appInitState, user, token, organizationId, loadMembership]);

  const canManage = canManageOrganization(membership);
  const ownerFlag = isOrgOwner(membership);

  return (
    <OrgContext.Provider
      value={{
        membership,
        orgPrograms,
        isLoading,
        canManage,
        isOwner: ownerFlag,
        refresh: loadMembership,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOrgContext(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrgContext must be used within OrgProvider");
  return ctx;
}
