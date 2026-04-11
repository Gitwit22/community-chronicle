/**
 * OrgProgramAccessSettings — two-tier program access control.
 *
 * Tier 1: Which programs the organization has enabled (org buys/unlocks).
 * Tier 2: Which users have access to each enabled program.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchOrgProgramAccess, fetchOrgMembers, updateUserProgramAccess } from "@/services/apiOrg";
import type { OrganizationProgramAccess, OrgMember } from "@/types/org";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Layers, Users, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export function OrgProgramAccessSettings() {
  const { token, organizationId } = useAuth();

  const [orgPrograms, setOrgPrograms] = useState<OrganizationProgramAccess[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token || !organizationId) return;
      setIsLoading(true);
      try {
        const [programsData, membersData] = await Promise.all([
          fetchOrgProgramAccess(organizationId, token),
          fetchOrgMembers(organizationId, token),
        ]);
        setOrgPrograms(programsData.programs);
        setMembers(membersData.members);
      } catch (err) {
        toast.error("Failed to load program access data.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [token, organizationId]); // eslint-disable-line

  const handleUserProgramToggle = async (
    userId: string,
    programId: string,
    enabled: boolean,
  ) => {
    if (!token || !organizationId) return;
    const key = `${userId}-${programId}`;
    setSaving(key);
    try {
      await updateUserProgramAccess(organizationId, userId, programId, enabled, token);
      setMembers((prev) =>
        prev.map((m) => {
          if (m.userId !== userId) return m;
          const programAccess = enabled
            ? [...m.programAccess, programId]
            : m.programAccess.filter((p) => p !== programId);
          return { ...m, programAccess };
        }),
      );
      toast.success(`Program access ${enabled ? "granted" : "revoked"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update access.");
    } finally {
      setSaving(null);
    }
  };

  const enabledPrograms = orgPrograms.filter((p) => p.enabled);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Program Access
        </h2>
        <p className="text-muted-foreground font-body mt-1">
          Control which programs are available to your organization and assign
          them to individual members.
        </p>
      </div>

      {/* Tier 1: Org-level programs */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Organization Programs
          </CardTitle>
          <CardDescription className="font-body">
            Programs enabled for your organization. Contact your suite
            administrator to enable or disable programs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-body text-sm">Loading…</span>
            </div>
          ) : orgPrograms.length === 0 ? (
            <p className="text-sm font-body text-muted-foreground text-center py-6">
              No programs configured for this organization.
            </p>
          ) : (
            <div className="space-y-3">
              {orgPrograms.map((prog) => (
                <div
                  key={prog.programId}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-body font-medium text-foreground">
                        {prog.programName ?? prog.programSlug ?? prog.programId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {prog.enabled ? (
                      <Badge className="text-xs font-body bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs font-body flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" /> Disabled
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tier 2: Per-user program assignment */}
      {enabledPrograms.length > 0 && members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Program Assignment
            </CardTitle>
            <CardDescription className="font-body">
              Assign enabled programs to individual members. Users only see
              programs assigned to them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                      Member
                    </th>
                    {enabledPrograms.map((prog) => (
                      <th
                        key={prog.programId}
                        className="text-center py-2 px-4 font-medium text-muted-foreground"
                      >
                        {prog.programName ?? prog.programSlug ?? prog.programId}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.userId} className="border-b border-border/50">
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-medium text-foreground">
                            {member.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </td>
                      {enabledPrograms.map((prog) => {
                        const hasAccess = member.programAccess.includes(prog.programId);
                        const key = `${member.userId}-${prog.programId}`;
                        return (
                          <td key={prog.programId} className="text-center py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <Switch
                                id={key}
                                checked={hasAccess}
                                disabled={saving === key}
                                onCheckedChange={(checked) =>
                                  handleUserProgramToggle(
                                    member.userId,
                                    prog.programId,
                                    checked,
                                  )
                                }
                              />
                              <Label htmlFor={key} className="sr-only">
                                {member.displayName} — {prog.programName}
                              </Label>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default OrgProgramAccessSettings;
