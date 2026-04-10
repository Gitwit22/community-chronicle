import { useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { rememberPostAuthReturnPath, getSuiteLoginUrl } from "@/lib/suiteLogin";

export default function SuiteAuthRedirect() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const returnTo = useMemo(() => {
    const explicitReturnTo = searchParams.get("returnTo");
    if (explicitReturnTo?.startsWith("/")) {
      return explicitReturnTo;
    }

    const stateFrom = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from;
    if (stateFrom?.pathname) {
      return `${stateFrom.pathname}${stateFrom.search || ""}${stateFrom.hash || ""}`;
    }

    return "/";
  }, [location.state, searchParams]);

  const suiteLoginUrl = useMemo(() => getSuiteLoginUrl(returnTo), [returnTo]);

  useEffect(() => {
    rememberPostAuthReturnPath(returnTo);
    window.location.replace(suiteLoginUrl);
  }, [returnTo, suiteLoginUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
