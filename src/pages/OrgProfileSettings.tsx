/**
 * OrgProfileSettings — edit the organization's name and profile details.
 * Requires org admin or owner role (enforced by OrgAdminRoute wrapper in router).
 */

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useOrgContext } from "@/context/OrgContext";
import { updateOrgProfile } from "@/services/apiOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export function OrgProfileSettings() {
  const { user, token, organizationId, organizationName } = useAuth();
  const { isOwner } = useOrgContext();

  const [name, setName] = useState(organizationName ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!token || !organizationId) return;
    setIsSaving(true);
    try {
      await updateOrgProfile(organizationId, { name }, token);
      toast.success("Organization profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Organization Profile
        </h2>
        <p className="text-muted-foreground font-body mt-1">
          Manage your organization's public information.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            General Info
          </CardTitle>
          <CardDescription className="font-body">
            This name is shown to all members of your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name" className="font-body">Organization Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-body max-w-sm"
              placeholder="Enter organization name"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-body text-muted-foreground text-xs">Owner</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-body text-foreground">
                {user?.displayName || user?.email}
              </span>
              {isOwner && (
                <Badge variant="secondary" className="text-xs font-body">You</Badge>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-body text-muted-foreground text-xs">Organization ID</Label>
            <p className="text-xs font-mono text-muted-foreground">{organizationId}</p>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="font-body"
            size="sm"
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default OrgProfileSettings;
