/**
 * OrgAdminRoute — renders children only if the current user is an
 * org owner or admin. Shows a loading spinner while membership resolves
 * and an access-denied message if the check fails.
 *
 * This guard works entirely from OrgContext — no extra API calls needed.
 */

import type { ReactNode } from "react";
import { useOrgContext } from "@/context/OrgContext";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert } from "lucide-react";

interface OrgAdminRouteProps {
  children: ReactNode;
  /** If true, require owner role (not just admin). Default false. */
  requireOwner?: boolean;
}

export function OrgAdminRoute({ children, requireOwner = false }: OrgAdminRouteProps) {
  const { isLoading: authLoading } = useAuth();
  const { membership, isLoading: orgLoading, isOwner, canManage } = useOrgContext();

  const isLoading = authLoading || orgLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const allowed = requireOwner ? isOwner : canManage;

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 text-center p-8">
        <ShieldAlert className="h-12 w-12 text-muted-foreground/50" />
        <h2 className="font-display text-xl font-bold text-foreground">
          Access Restricted
        </h2>
        <p className="text-muted-foreground font-body max-w-sm">
          {requireOwner
            ? "This area is only accessible to the organization owner."
            : "This area requires organization admin or owner privileges."}
        </p>
        {membership && (
          <p className="text-xs text-muted-foreground font-body">
            Your current role: <span className="font-medium capitalize">{membership.role}</span>
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

export default OrgAdminRoute;
