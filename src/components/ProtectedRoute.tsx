import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Guards a route with three checks (in order):
 *
 * 1. Auth guard  — is there a valid session?          → /login if not
 * 2. Init guard  — has the app been initialized?      → /setup if not
 * 3. Org guard   — does the user have org context?    → /setup if not
 *
 * While auth is hydrating ("unknown") a spinner is shown so there is no
 * flash of redirect.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, appInitState, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // 1. Auth guard
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2 & 3. Init / org guard
  if (appInitState === "not_initialized" || appInitState === "no_org") {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
