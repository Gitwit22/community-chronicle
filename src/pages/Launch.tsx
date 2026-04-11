import { Navigate } from "react-router-dom";

// Phase 1: auth handoff disabled. Suite opens Chronicle directly; no token exchange.
export default function Launch() {
  return <Navigate to="/" replace />;
}
