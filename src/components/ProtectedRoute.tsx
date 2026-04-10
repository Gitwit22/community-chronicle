import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { PROGRAM_SYSTEM_NAME } from "@/lib/programInfo";
import { getSuiteLoginUrl, rememberPostAuthReturnPath } from "@/lib/suiteLogin";

/** Redirect the browser (hard navigation) to the suite login page. */
function SuiteLoginRedirect({ returnTo }: { returnTo: string }) {
  useEffect(() => {
    rememberPostAuthReturnPath(returnTo);
    console.warn("[chronicle-launch] redirecting to suite login", {
      reason: "unauthenticated_or_role_denied",
      returnTo,
      destination: getSuiteLoginUrl(returnTo),
    });
    window.location.replace(getSuiteLoginUrl(returnTo));
  }, [returnTo]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

const ROLE_LEVEL: Record<string, number> = {
  uploader: 1,
  reviewer: 2,
  admin: 3,
};

/**
 * Tenant-aware route guard.
 *
 * Decision tree:
 *  1. Still loading session                -> spinner
 *  2. Not authenticated                    -> suite /login (external)
 *  3. Not initialized or missing org       -> /org-setup
 *  4. Missing/wrong program domain context -> /org-setup
 *  5. Role insufficient (if requiredRole)  -> suite /login (external)
 *  6. Otherwise                            -> render children
 */
export function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: "uploader" | "reviewer" | "admin";
}) {
  const { user, appInitState, isLoading, role, programDomain } = useAuth();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    console.warn("[chronicle-launch] guard redirect", {
      reason: "no_user",
      returnTo,
    });
    return <SuiteLoginRedirect returnTo={returnTo} />;
  }

  if (appInitState === "not_initialized" || appInitState === "no_org") {
    console.warn("[chronicle-launch] guard redirect", {
      reason: "app_not_initialized_or_no_org",
      appInitState,
    });
    return <Navigate to="/org-setup" replace />;
  }

  if (!programDomain || programDomain !== PROGRAM_SYSTEM_NAME) {
    console.warn("[chronicle-launch] guard redirect", {
      reason: "program_domain_mismatch",
      programDomain,
      expected: PROGRAM_SYSTEM_NAME,
    });
    return <Navigate to="/org-setup" replace />;
  }

  if (
    requiredRole &&
    (ROLE_LEVEL[role ?? ""] ?? 0) < (ROLE_LEVEL[requiredRole] ?? 0)
  ) {
    console.warn("[chronicle-launch] guard redirect", {
      reason: "role_insufficient",
      role,
      requiredRole,
      returnTo,
    });
    return <SuiteLoginRedirect returnTo={returnTo} />;
  }

  return <>{children}</>;
}

export default ProtectedRoute;
