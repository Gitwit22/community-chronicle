/**
 * SuiteAdminRoute — renders children only if the current user holds the
 * suite_admin platform role. Org admins do NOT pass this guard unless they
 * are also suite admins.
 */

import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { isSuiteAdmin } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";

export function SuiteAdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSuiteAdmin(user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 text-center p-8">
        <ShieldAlert className="h-12 w-12 text-muted-foreground/50" />
        <h2 className="font-display text-xl font-bold text-foreground">
          Suite Admin Only
        </h2>
        <p className="text-muted-foreground font-body max-w-sm">
          This area is reserved for platform administrators only. Organization
          admins do not have access to suite-wide controls.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export default SuiteAdminRoute;
