/**
 * OrgSettingsLayout — sidebar navigation layout for organization settings.
 */

import { NavLink, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import {
  Building2,
  Users,
  ShieldCheck,
  Layers,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PROGRAM_DISPLAY_NAME } from "@/lib/programInfo";

const NAV_ITEMS = [
  { to: "profile", label: "Organization Profile", icon: Building2 },
  { to: "users", label: "Users", icon: Users },
  { to: "roles", label: "Roles & Admins", icon: ShieldCheck },
  { to: "programs", label: "Program Access", icon: Layers },
  { to: "invitations", label: "Invitations", icon: Mail },
] as const;

interface OrgSettingsLayoutProps {
  children: ReactNode;
  orgName?: string;
}

export function OrgSettingsLayout({ children, orgName }: OrgSettingsLayoutProps) {
  const { slug } = useParams<{ slug: string }>();
  const backHref = slug ? `/org/${slug}` : "/";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-6xl py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <a href={backHref} className="gap-2 font-body text-sm flex items-center">
              <ArrowLeft className="h-4 w-4" />
              Back to Portal
            </a>
          </Button>
          <div className="h-5 w-px bg-border" />
          <div>
            <span className="text-sm font-medium font-body text-foreground">
              {orgName ?? "Organization"} Settings
            </span>
            <span className="text-xs text-muted-foreground font-body ml-2">
              — {PROGRAM_DISPLAY_NAME}
            </span>
          </div>
        </div>
      </header>

      <div className="container max-w-6xl py-8 flex gap-8">
        <aside className="w-52 shrink-0">
          <nav className="space-y-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={slug ? `/org/${slug}/settings/${to}` : `/settings/${to}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-body transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

export default OrgSettingsLayout;
