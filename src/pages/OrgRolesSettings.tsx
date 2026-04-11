/**
 * OrgRolesSettings — overview of what each role can do within the org.
 * Also lets owners promote/demote users between admin and other roles.
 */

import type { ComponentType } from "react";
import { ShieldCheck, Crown, Shield, User, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrgRole } from "@/types/org";

const ROLE_DEFINITIONS: Array<{
  role: OrgRole;
  icon: ComponentType<{ className?: string }>;
  label: string;
  description: string;
  permissions: string[];
  badgeClass: string;
}> = [
  {
    role: "owner",
    icon: Crown,
    label: "Owner",
    description: "Full control over the organization.",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    permissions: [
      "All admin permissions",
      "Transfer organization ownership",
      "Delete the organization",
      "Manage all members including other admins",
    ],
  },
  {
    role: "admin",
    icon: ShieldCheck,
    label: "Admin",
    description: "Can manage users, roles, and program access.",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    permissions: [
      "Manage organization settings",
      "Add and remove members",
      "Assign roles (up to admin)",
      "Control program access for users",
      "Send invitations",
    ],
  },
  {
    role: "manager",
    icon: Shield,
    label: "Manager",
    description: "Can manage team members and view settings.",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    permissions: [
      "View organization settings (read-only)",
      "Manage member program assignments",
      "Access all enabled programs",
    ],
  },
  {
    role: "member",
    icon: User,
    label: "Member",
    description: "Access to programs assigned to them.",
    badgeClass: "bg-muted text-muted-foreground",
    permissions: [
      "Access assigned programs only",
      "View org dashboard",
      "No access to Settings",
    ],
  },
  {
    role: "viewer",
    icon: Eye,
    label: "Viewer",
    description: "Read-only access to assigned programs.",
    badgeClass: "bg-muted text-muted-foreground",
    permissions: [
      "View assigned programs (read-only)",
      "Cannot upload or modify content",
    ],
  },
];

export function OrgRolesSettings() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Roles & Admins
        </h2>
        <p className="text-muted-foreground font-body mt-1">
          Understand what each role can do. Assign roles in the{" "}
          <a href="users" className="text-primary underline underline-offset-2">
            Users
          </a>{" "}
          tab.
        </p>
      </div>

      <div className="space-y-4">
        {ROLE_DEFINITIONS.map(
          ({ role, icon: Icon, label, description, permissions, badgeClass }) => (
            <Card key={role}>
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{label}</span>
                    <Badge className={`text-xs font-body capitalize ${badgeClass}`}>
                      {role}
                    </Badge>
                  </div>
                </CardTitle>
                <p className="text-sm font-body text-muted-foreground pl-11">
                  {description}
                </p>
              </CardHeader>
              <CardContent className="pl-11">
                <ul className="space-y-1.5">
                  {permissions.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2 text-sm font-body text-foreground"
                    >
                      <span className="text-primary mt-0.5">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ),
        )}
      </div>

      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-900/10">
        <CardContent className="pt-4">
          <p className="text-sm font-body text-amber-800 dark:text-amber-400">
            <strong>Important:</strong> Organization admin roles are entirely
            separate from suite-wide platform roles. An org admin cannot access
            suite admin controls unless they also hold a platform-level{" "}
            <code className="text-xs bg-amber-100 dark:bg-amber-900/30 px-1 rounded">
              suite_admin
            </code>{" "}
            role, which is assigned by platform administrators only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default OrgRolesSettings;
