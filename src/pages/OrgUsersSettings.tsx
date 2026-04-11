/**
 * OrgUsersSettings — list and manage organization members.
 * Requires org admin or owner role.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useOrgContext } from "@/context/OrgContext";
import { fetchOrgMembers, updateMemberRole, removeMember } from "@/services/apiOrg";
import type { OrgMember, OrgRole } from "@/types/org";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Users, Trash2, Loader2 } from "lucide-react";

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const ROLE_COLORS: Record<OrgRole, string> = {
  owner: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  manager: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  member: "bg-muted text-muted-foreground",
  viewer: "bg-muted text-muted-foreground",
};

export function OrgUsersSettings() {
  const { token, organizationId, user: currentUser } = useAuth();
  const { isOwner } = useOrgContext();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    if (!token || !organizationId) return;
    setIsLoading(true);
    try {
      const data = await fetchOrgMembers(organizationId, token);
      setMembers(data.members);
    } catch (err) {
      toast.error("Failed to load members.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token, organizationId]); // eslint-disable-line

  const handleRoleChange = async (userId: string, role: OrgRole) => {
    if (!token || !organizationId) return;
    setSaving(userId);
    try {
      await updateMemberRole(organizationId, userId, role, token);
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role } : m)),
      );
      toast.success("Role updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setSaving(null);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!token || !organizationId) return;
    setSaving(userId);
    try {
      await removeMember(organizationId, userId, token);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success("Member removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Users</h2>
        <p className="text-muted-foreground font-body mt-1">
          Manage who belongs to your organization and their roles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members
            {!isLoading && (
              <Badge variant="secondary" className="font-body text-xs ml-1">
                {members.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="font-body">
            Owners and admins can change roles. Only owners can remove other
            owners.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-body text-sm">Loading members…</span>
            </div>
          ) : members.length === 0 ? (
            <p className="text-center text-muted-foreground font-body py-8 text-sm">
              No members found.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member) => {
                const isCurrentUser = member.userId === currentUser?.id;
                const canEditRole = isOwner || (!isCurrentUser && member.role !== "owner");
                return (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between py-3 gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-body font-medium text-foreground truncate">
                        {member.displayName}
                        {isCurrentUser && (
                          <span className="text-muted-foreground font-normal ml-1">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-body text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canEditRole ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) => handleRoleChange(member.userId, v as OrgRole)}
                          disabled={saving === member.userId}
                        >
                          <SelectTrigger className="h-8 w-32 font-body text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.filter((r) =>
                              isOwner ? true : r.value !== "owner",
                            ).map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="font-body text-xs"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span
                          className={`text-xs font-body px-2 py-1 rounded-full capitalize ${ROLE_COLORS[member.role]}`}
                        >
                          {member.role}
                        </span>
                      )}

                      {!isCurrentUser && (isOwner || member.role !== "owner") && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={saving === member.userId}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-display">
                                Remove Member
                              </AlertDialogTitle>
                              <AlertDialogDescription className="font-body">
                                Remove <strong>{member.displayName}</strong> from
                                this organization? They will lose access to all
                                org programs immediately.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="font-body bg-destructive hover:bg-destructive/90"
                                onClick={() => handleRemove(member.userId)}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default OrgUsersSettings;
