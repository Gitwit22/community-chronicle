import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { consumePostAuthReturnPath, getSuiteLoginUrl } from "@/lib/suiteLogin";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { PROGRAM_SYSTEM_NAME } from "@/lib/programInfo";

function getLaunchTokenFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? params.get("launchToken");
}

export default function Launch() {
  const navigate = useNavigate();
  const { isLoading, user, programDomain, consumePlatformLaunch } = useAuth();
  const suiteLoginUrl = useMemo(() => getSuiteLoginUrl("/"), []);
  const [launchError, setLaunchError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    const postAuthPath = consumePostAuthReturnPath() ?? "/";
    const launchToken = getLaunchTokenFromQuery();

    console.info("[chronicle-launch] token detected", {
      hasToken: Boolean(launchToken),
      hasUser: Boolean(user),
      programDomain,
      isLoading,
    });

    // Only short-circuit when session already belongs to this app domain.
    if (user && programDomain === PROGRAM_SYSTEM_NAME) {
      console.info("[chronicle-launch] redirecting to app (existing session)", {
        destination: postAuthPath,
      });
      navigate(postAuthPath, { replace: true });
      return;
    }

    if (!launchToken) {
      const reason = "Launch token was not found in the URL.";
      console.error("[chronicle-launch] consume failed", { reason });
      setLaunchError(reason);
      return;
    }

    let cancelled = false;
    console.info("[chronicle-launch] consume started", {
      destinationAfterConsume: postAuthPath,
    });

    consumePlatformLaunch(launchToken).then((result) => {
      if (cancelled) return;
      if (result.success) {
        console.info("[chronicle-launch] redirecting to app", {
          destination: postAuthPath,
          userId: result.user.id,
          programDomain: result.user.programDomain,
        });
        setLaunchError(null);
        navigate(postAuthPath, { replace: true });
        return;
      }

      const reason = result.error.message || "Launch validation failed.";
      console.error("[chronicle-launch] consume failed", { reason });
      setLaunchError(reason);
    });

    return () => {
      cancelled = true;
    };
  }, [consumePlatformLaunch, isLoading, navigate, programDomain, suiteLoginUrl, user]);

  if (launchError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-lg w-full rounded-xl border border-destructive/40 bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <h1 className="text-lg font-semibold">Launch failed</h1>
          </div>
          <p className="text-sm text-muted-foreground">Community Chronicle could not complete suite handoff.</p>
          <div className="rounded-md bg-muted p-3 text-sm text-foreground break-words">
            {launchError}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.location.reload()}>Retry Launch</Button>
            <Button variant="outline" onClick={() => window.location.replace(suiteLoginUrl)}>Back to Suite Login</Button>
            <Button variant="ghost" onClick={() => navigate("/landing", { replace: true })}>Open Public Landing</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
