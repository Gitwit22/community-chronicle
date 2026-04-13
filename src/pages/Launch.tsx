import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Suite launch handoff page.
 *
 * Accepts a ?token= param from the Nxt Lvl Suite hub, exchanges it for a
 * Chronicle-scoped session via consumePlatformLaunch, then redirects to the
 * archive root. If no token is present, or the exchange fails, falls back to
 * the root so the user lands on the public archive (unauthenticated).
 */
export default function Launch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { consumePlatformLaunch } = useAuth();
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;

    const token = searchParams.get("token") ?? searchParams.get("launchToken");

    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    void (async () => {
      try {
        await consumePlatformLaunch(token);
      } catch {
        // Token exchange failed — continue to root unauthenticated
      } finally {
        // Full page replace so AuthContext re-initializes with the stored session
        window.location.replace("/");
      }
    })();
  }, [searchParams, navigate, consumePlatformLaunch]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
    </div>
  );
}
