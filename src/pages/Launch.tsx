import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { consumePostAuthReturnPath, getSuiteLoginUrl } from "@/lib/suiteLogin";

function getLaunchTokenFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? params.get("launchToken");
}

export default function Launch() {
  const navigate = useNavigate();
  const { isLoading, user, consumePlatformLaunch } = useAuth();
  const suiteLoginUrl = useMemo(() => getSuiteLoginUrl("/"), []);

  useEffect(() => {
    if (isLoading) return;

    if (user) {
      navigate(consumePostAuthReturnPath() ?? "/", { replace: true });
      return;
    }

    const launchToken = getLaunchTokenFromQuery();
    if (!launchToken) {
      window.location.replace(suiteLoginUrl);
      return;
    }

    let cancelled = false;
    consumePlatformLaunch(launchToken).then((result) => {
      if (cancelled) return;
      if (result.success) {
        navigate(consumePostAuthReturnPath() ?? "/", { replace: true });
        return;
      }
      window.location.replace(suiteLoginUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [consumePlatformLaunch, isLoading, navigate, suiteLoginUrl, user]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
