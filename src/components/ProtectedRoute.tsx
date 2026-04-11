import type { ReactNode } from "react";

// Phase 1: auth gate disabled. All routes are open while the data model stabilises.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default ProtectedRoute;
