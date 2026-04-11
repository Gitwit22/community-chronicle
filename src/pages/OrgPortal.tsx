/**
 * OrgPortal — the organization-scoped entry point at /org/:slug.
 *
 * Resolves the organization from the URL slug, loads the current user's
 * membership and allowed programs, then renders the org dashboard with
 * role-appropriate navigation.
 *
 * Auth check order:
 *  1. Still loading → spinner
 *  2. Not authenticated → redirect to suite login
 *  3. Org not found or user not a member → access denied
 *  4. Ready → render portal
 */

import { useParams, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Layers,
  User,
  Settings,
  ExternalLink,
  Building2,
  Shield,
  ChevronDown,
  LogOut,
  BookOpen,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/context/AuthContext";
import { useOrgContext } from "@/context/OrgContext";
import { isSuiteAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PROGRAM_DISPLAY_NAME } from "@/lib/programInfo";
import { getSuiteLoginUrl } from "@/lib/suiteLogin";

const ORG_ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  viewer: "Viewer",
};

export function OrgPortal() {
  const { slug } = useParams<{ slug: string }>();
  const {
    user,
    token,
    organizationName,
    isLoading: authLoading,
    logout,
  } = useAuth();
  const { membership, canManage, isLoading: orgLoading } = useOrgContext();
  const [activeTab, setActiveTab] = useState("dashboard");

  const isLoading = authLoading || orgLoading;

  // Track page title
  useEffect(() => {
    if (organizationName) {
      document.title = `${organizationName} Portal — ${PROGRAM_DISPLAY_NAME}`;
    }
  }, [organizationName]);

  // Still loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated
  if (!user || !token) {
    return <Navigate to={getSuiteLoginUrl(`/org/${slug ?? ""}`)} replace />;
  }

  const handleLogout = () => {
    logout();
  };

  const handleOpenSuite = () => {
    const suiteBase =
      (import.meta.env.VITE_SUITE_URL as string | undefined) ??
      "https://nltops.com";
    // Pass org context so the suite can preserve it
    const url = new URL("/", suiteBase);
    if (user.organizationId) url.searchParams.set("orgId", user.organizationId);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-6xl py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground leading-tight">
                {organizationName ?? "Organization Portal"}
              </h1>
              <p className="text-xs text-muted-foreground font-body">
                {PROGRAM_DISPLAY_NAME}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Browse More Programs / Go to Suite */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 font-body text-sm hidden sm:flex"
              onClick={handleOpenSuite}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Browse Programs
            </Button>

            {/* Suite admin indicator */}
            {isSuiteAdmin(user) && (
              <Badge
                variant="secondary"
                className="hidden sm:flex text-xs font-body gap-1"
              >
                <Shield className="h-3 w-3" />
                Suite Admin
              </Badge>
            )}

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 font-body text-sm">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {user.displayName || user.email}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium font-body leading-none">
                      {user.displayName || user.email}
                    </p>
                    <p className="text-xs text-muted-foreground font-body truncate">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{organizationName ?? "—"}</span>
                  </div>
                  {membership && (
                    <Badge variant="secondary" className="text-xs font-body h-5">
                      {ORG_ROLE_LABEL[membership.role] ?? membership.role}
                    </Badge>
                  )}
                </div>
                <DropdownMenuSeparator />
                {/* Go to Suite (mobile) */}
                <DropdownMenuItem
                  className="gap-2 font-body text-sm cursor-pointer sm:hidden"
                  onSelect={handleOpenSuite}
                >
                  <ExternalLink className="h-4 w-4" />
                  Browse Programs
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 font-body text-sm cursor-pointer text-destructive focus:text-destructive"
                  onSelect={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container max-w-6xl py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/60">
            {/* Visible to all org users */}
            <TabsTrigger value="dashboard" className="font-body gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="programs" className="font-body gap-2">
              <Layers className="h-4 w-4" />
              Programs
            </TabsTrigger>
            <TabsTrigger value="my-access" className="font-body gap-2">
              <User className="h-4 w-4" />
              My Access
            </TabsTrigger>

            {/* Visible only to org owner/admin */}
            {canManage && (
              <TabsTrigger
                value="settings"
                className="font-body gap-2"
                onClick={(e) => {
                  // Navigate to full settings route
                  e.preventDefault();
                  window.location.href = `/org/${slug}/settings/profile`;
                }}
              >
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            )}
          </TabsList>

          {/* Dashboard tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Welcome back{user.displayName ? `, ${user.displayName}` : ""}
                </h2>
                <p className="text-muted-foreground font-body mt-1">
                  {organizationName} — Community Chronicle Portal
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                className="gap-2 font-body"
                onClick={handleOpenSuite}
              >
                <ExternalLink className="h-4 w-4" />
                Nxt Lvl Suite
              </Button>
            </div>

            {/* Quick nav cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <OrgNavCard
                icon={BookOpen}
                title="Document Archive"
                description="Browse and search community documents"
                href="/"
              />
              <OrgNavCard
                icon={Layers}
                title="My Programs"
                description="Access your assigned programs"
                onClick={() => setActiveTab("programs")}
              />
              <OrgNavCard
                icon={ExternalLink}
                title="Browse More"
                description="Explore all available programs"
                onClick={handleOpenSuite}
              />
            </div>
          </TabsContent>

          {/* Programs tab */}
          <TabsContent value="programs" className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                Programs
              </h2>
              <p className="text-muted-foreground font-body mt-1">
                Programs available to your organization.
              </p>
            </div>

            <div className="grid gap-4">
              {/* Community Chronicle is always the current program */}
              <ProgramCard
                name={PROGRAM_DISPLAY_NAME}
                description="Civil rights document archive and research platform."
                slug="community-chronicle"
                isActive
                href="/"
              />
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm font-body text-muted-foreground mb-3">
                Looking for more programs?
              </p>
              <Button
                variant="outline"
                className="gap-2 font-body"
                onClick={handleOpenSuite}
              >
                <ExternalLink className="h-4 w-4" />
                Browse the Nxt Lvl Suite
              </Button>
            </div>
          </TabsContent>

          {/* My Access tab */}
          <TabsContent value="my-access" className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                My Access
              </h2>
              <p className="text-muted-foreground font-body mt-1">
                Your role and permissions within {organizationName}.
              </p>
            </div>

            <Card className="max-w-sm">
              <CardHeader>
                <CardTitle className="font-display text-base">
                  Your Organization Role
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {membership ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-body font-medium text-foreground">
                          {user.displayName}
                        </p>
                        <p className="text-xs font-body text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="font-body text-sm capitalize">
                        {ORG_ROLE_LABEL[membership.role] ?? membership.role}
                      </Badge>
                      {canManage && (
                        <span className="text-xs text-muted-foreground font-body">
                          · Can manage organization settings
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-body text-muted-foreground">
                    Loading your membership…
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OrgNavCard({
  icon: Icon,
  title,
  description,
  href,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <span className="font-body text-sm font-semibold text-foreground">
        {title}
      </span>
      <span className="font-body text-xs text-muted-foreground">{description}</span>
    </div>
  );

  if (href) {
    return <a href={href}>{inner}</a>;
  }
  return <button type="button" onClick={onClick} className="text-left">{inner}</button>;
}

function ProgramCard({
  name,
  description,
  isActive,
  href,
}: {
  name: string;
  description: string;
  slug: string;
  isActive?: boolean;
  href?: string;
}) {
  return (
    <Card className={isActive ? "border-primary/30" : ""}>
      <CardContent className="flex items-center justify-between pt-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-body font-semibold text-foreground text-sm">{name}</p>
            <p className="font-body text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <Badge className="text-xs font-body bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              Active
            </Badge>
          )}
          {href && (
            <Button variant="outline" size="sm" className="font-body" asChild>
              <a href={href}>Open</a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default OrgPortal;
