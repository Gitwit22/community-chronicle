import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

const SESSION_KEYS = ["chronicle_auth_token", "chronicle_auth_user"];

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[app-error-boundary] Unhandled render error", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearSession = () => {
    for (const key of SESSION_KEYS) {
      window.localStorage.removeItem(key);
    }
    window.location.replace("/login");
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-3">
            Application Error
          </p>
          <h1 className="font-display text-2xl font-bold text-foreground mb-3">
            Community Chronicle hit a loading error.
          </h1>
          <p className="font-body text-sm leading-relaxed text-muted-foreground mb-6">
            This usually means the app hit a runtime error while restoring the current session.
            Reload the page first. If the error persists, clear the local session and sign in again.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={this.handleReload} className="font-body">
              Reload Page
            </Button>
            <Button onClick={this.handleClearSession} variant="outline" className="font-body">
              Clear Session And Sign In Again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;