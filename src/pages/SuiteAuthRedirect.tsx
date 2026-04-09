import { useEffect, useMemo } from "react";
import { rememberPostAuthReturnPath, getSuiteLoginUrl } from "@/lib/suiteLogin";

export default function SuiteAuthRedirect() {
  const suiteLoginUrl = useMemo(() => getSuiteLoginUrl("/"), []);

  useEffect(() => {
    rememberPostAuthReturnPath("/");
    window.location.replace(suiteLoginUrl);
  }, [suiteLoginUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
