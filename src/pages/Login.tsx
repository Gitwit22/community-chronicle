import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { PROGRAM_DISPLAY_NAME } from "@/lib/programInfo";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await login(email.trim().toLowerCase(), password);

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Login failed.");
      return;
    }

    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm">
        <div className="container max-w-6xl py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground leading-tight">
              {PROGRAM_DISPLAY_NAME}
            </h1>
            <p className="text-xs text-muted-foreground font-body">Sign in to your account</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-md">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="font-display text-lg">Sign In</CardTitle>
              <CardDescription className="font-body text-sm">
                Enter your credentials to access the archive.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {error && (
                  <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive font-body">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-body text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="font-body"
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="font-body text-sm font-medium">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="font-body"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full font-body bg-primary hover:bg-primary/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
