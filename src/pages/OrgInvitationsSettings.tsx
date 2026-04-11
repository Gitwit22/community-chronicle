/**
 * OrgInvitationsSettings — send and manage pending invitations.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchOrgInvitations, inviteOrgMember, revokeInvitation } from "@/services/apiOrg";
import type { OrgInvitation, OrgRole } from "@/types/org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { Mail, Send, X, Loader2, Clock } from "lucide-react";

const ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

const STATUS_STYLES: Record<OrgInvitation["status"], string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  expired: "bg-muted text-muted-foreground",
  revoked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function OrgInvitationsSettings() {
  const { token, organizationId } = useAuth();

  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");

  const load = async () => {
    if (!token || !organizationId) return;
    setIsLoading(true);
    try {
      const data = await fetchOrgInvitations(organizationId, token);
      setInvitations(data.invitations);
    } catch (err) {
      toast.error("Failed to load invitations.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token, organizationId]); // eslint-disable-line

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !organizationId || !email.trim()) return;

    setIsSending(true);
    try {
      await inviteOrgMember(organizationId, email.trim(), role, token);
      toast.success(`Invitation sent to ${email.trim()}.`);
      setEmail("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally {
      setIsSending(false);
    }
  };

  const handleRevoke = async (invitationId: string, invEmail: string) => {
    if (!token || !organizationId) return;
    setRevoking(invitationId);
    try {
      await revokeInvitation(organizationId, invitationId, token);
      toast.success(`Invitation to ${invEmail} revoked.`);
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === invitationId ? { ...inv, status: "revoked" as const } : inv,
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke invitation.");
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Invitations
        </h2>
        <p className="text-muted-foreground font-body mt-1">
          Invite people to join your organization by email.
        </p>
      </div>

      {/* Send invitation form */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send Invitation
          </CardTitle>
          <CardDescription className="font-body">
            The invited person will receive an email with a link to join.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email" className="font-body text-xs">
                Email address
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="font-body"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role" className="font-body text-xs">
                Role
              </Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as OrgRole)}
              >
                <SelectTrigger id="invite-role" className="w-36 font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="font-body"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={isSending || !email.trim()}
                className="font-body gap-2 w-full sm:w-auto"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {isSending ? "Sending…" : "Send Invite"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Invitation list */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-body text-sm">Loading…</span>
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-center text-muted-foreground font-body py-6 text-sm">
              No invitations sent yet.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-medium text-foreground truncate">
                      {inv.email}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-body text-muted-foreground capitalize">
                        {inv.role}
                      </span>
                      {inv.expiresAt && (
                        <span className="text-xs font-body text-muted-foreground">
                          · expires{" "}
                          {new Date(inv.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      className={`text-xs font-body capitalize ${STATUS_STYLES[inv.status]}`}
                    >
                      {inv.status}
                    </Badge>
                    {inv.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={revoking === inv.id}
                        onClick={() => handleRevoke(inv.id, inv.email)}
                        title="Revoke invitation"
                      >
                        {revoking === inv.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default OrgInvitationsSettings;
