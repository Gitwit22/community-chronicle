/**
 * PageFirstReview — page-first document intake review screen.
 *
 * Route: /documents/page-first/review/:uploadId
 *
 * Loads all DocumentPage and DocumentPacket records for a given OriginalUpload.
 * Lets the reviewer:
 *   - Edit per-page labels (docType, company, person, date)
 *   - Approve / reject suggested packets
 *   - Create packets from selected pages
 *   - Detach individual pages from packets
 *   - Re-run the grouping engine
 */

import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Plus,
  Tag,
  AlertTriangle,
  FileText,
  Layers,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useUploadPages,
  useUploadPackets,
  usePatchPageLabels,
  useCreatePacket,
  usePatchPacket,
  useDetachPageFromPacket,
  useRegroupUpload,
} from "@/hooks/usePageFirstIntake";
import { PAGE_FIRST_INTAKE_ENABLED } from "@/lib/featureFlags";
import type {
  DocumentPage,
  DocumentPacket,
  PatchPageLabelsRequest,
  DocumentPacketStatus,
} from "@/types/pageFirstIntake";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function packetStatusBadge(status: DocumentPacketStatus) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800 border-green-300">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 border-red-300">Rejected</Badge>;
    case "manually_created":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Manual</Badge>;
    default:
      return <Badge variant="outline">Suggested</Badge>;
  }
}

function confidencePct(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline label editor
// ─────────────────────────────────────────────────────────────────────────────

interface LabelEditorProps {
  page: DocumentPage;
  uploadId: string;
  onClose: () => void;
}

function LabelEditor({ page, uploadId, onClose }: LabelEditorProps) {
  const [form, setForm] = useState<PatchPageLabelsRequest>({
    detectedDocType: page.detectedDocType ?? "",
    detectedCompanyOrOrg: page.detectedCompanyOrOrg ?? "",
    detectedPersonName: page.detectedPersonName ?? "",
    detectedMonth: page.detectedMonth ?? undefined,
    detectedYear: page.detectedYear ?? undefined,
    detectedDate: page.detectedDate ?? "",
    needsReview: page.needsReview,
  });

  const patchLabels = usePatchPageLabels(uploadId);

  const handleSave = async () => {
    try {
      await patchLabels.mutateAsync({
        pageId: page.id,
        updates: {
          detectedDocType: form.detectedDocType || null,
          detectedCompanyOrOrg: form.detectedCompanyOrOrg || null,
          detectedPersonName: form.detectedPersonName || null,
          detectedMonth: form.detectedMonth ?? null,
          detectedYear: form.detectedYear ?? null,
          detectedDate: form.detectedDate || null,
          needsReview: form.needsReview,
        },
      });
      toast.success(`Page ${page.pageNumber} labels saved`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save labels");
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-body">Document type</Label>
          <Input
            value={form.detectedDocType ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, detectedDocType: e.target.value }))}
            placeholder="invoice, receipt, grant…"
            className="h-8 text-sm font-body"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-body">Company / org</Label>
          <Input
            value={form.detectedCompanyOrOrg ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, detectedCompanyOrOrg: e.target.value }))}
            placeholder="ACME Corp"
            className="h-8 text-sm font-body"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-body">Person name</Label>
          <Input
            value={form.detectedPersonName ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, detectedPersonName: e.target.value }))}
            placeholder="Jane Smith"
            className="h-8 text-sm font-body"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-body">Date</Label>
          <Input
            value={form.detectedDate ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, detectedDate: e.target.value }))}
            placeholder="2024-01-15"
            className="h-8 text-sm font-body"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-body">Month</Label>
          <Input
            type="number"
            min={1}
            max={12}
            value={form.detectedMonth ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                detectedMonth: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
            placeholder="1–12"
            className="h-8 text-sm font-body"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-body">Year</Label>
          <Input
            type="number"
            min={1900}
            max={2100}
            value={form.detectedYear ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                detectedYear: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
            placeholder="2024"
            className="h-8 text-sm font-body"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`needs-review-${page.id}`}
          checked={form.needsReview ?? false}
          onCheckedChange={(checked) =>
            setForm((f) => ({ ...f, needsReview: checked === true }))
          }
        />
        <Label htmlFor={`needs-review-${page.id}`} className="text-xs font-body cursor-pointer">
          Flag for review
        </Label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onClose} className="font-body h-8">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={patchLabels.isPending}
          className="font-body h-8"
        >
          {patchLabels.isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Saving…
            </>
          ) : (
            "Save labels"
          )}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page row
// ─────────────────────────────────────────────────────────────────────────────

interface PageRowProps {
  page: DocumentPage;
  uploadId: string;
  selected: boolean;
  onToggleSelect: (pageId: string) => void;
}

function PageRow({ page, uploadId, selected, onToggleSelect }: PageRowProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(page.id)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-xs font-semibold text-muted-foreground">
              Page {page.pageNumber}
            </span>
            {page.detectedDocType && (
              <Badge variant="secondary" className="text-xs font-body">
                {page.detectedDocType}
              </Badge>
            )}
            {page.needsReview && (
              <Badge variant="outline" className="text-xs text-orange-700 border-orange-300 font-body">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Review
              </Badge>
            )}
            <span className="text-xs text-muted-foreground font-body ml-auto">
              {confidencePct(page.confidence)} confidence
            </span>
          </div>

          {(page.detectedCompanyOrOrg || page.detectedPersonName) && (
            <p className="font-body text-xs text-foreground mt-1">
              {[page.detectedCompanyOrOrg, page.detectedPersonName].filter(Boolean).join(" · ")}
              {page.detectedYear && ` · ${page.detectedYear}`}
            </p>
          )}

          {page.pageText && (
            <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">
              {page.pageText}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing((v) => !v)}
          className="font-body h-7 px-2 text-xs flex-shrink-0"
        >
          <Tag className="h-3 w-3 mr-1" />
          {editing ? "Close" : "Edit labels"}
        </Button>
      </div>

      {editing && (
        <div className="pl-7 pt-1">
          <LabelEditor page={page} uploadId={uploadId} onClose={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Packet card
// ─────────────────────────────────────────────────────────────────────────────

interface PacketCardProps {
  packet: DocumentPacket;
  uploadId: string;
  pages: DocumentPage[];
}

function PacketCard({ packet, uploadId, pages }: PacketCardProps) {
  const patchPacket = usePatchPacket(uploadId);
  const detachPage = useDetachPageFromPacket(uploadId);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(packet.title);

  const packetPageIds = new Set((packet.pages ?? []).map((pp) => pp.pageId));
  const linkedPages = pages.filter((p) => packetPageIds.has(p.id));

  const handleApprove = async () => {
    try {
      await patchPacket.mutateAsync({ packetId: packet.id, updates: { status: "approved" } });
      toast.success("Packet approved");
    } catch {
      toast.error("Failed to approve packet");
    }
  };

  const handleReject = async () => {
    try {
      await patchPacket.mutateAsync({ packetId: packet.id, updates: { status: "rejected" } });
      toast.success("Packet rejected");
    } catch {
      toast.error("Failed to reject packet");
    }
  };

  const handleSaveTitle = async () => {
    if (!titleDraft.trim()) return;
    try {
      await patchPacket.mutateAsync({ packetId: packet.id, updates: { title: titleDraft.trim() } });
      setEditingTitle(false);
      toast.success("Packet title updated");
    } catch {
      toast.error("Failed to update title");
    }
  };

  const handleDetach = async (pageId: string) => {
    try {
      await detachPage.mutateAsync({ packetId: packet.id, pageId });
      toast.success("Page detached");
    } catch {
      toast.error("Failed to detach page");
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        packet.status === "approved"
          ? "border-green-300 bg-green-50/40"
          : packet.status === "rejected"
          ? "border-red-200 bg-red-50/20 opacity-60"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex gap-1">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="h-7 text-sm font-body"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveTitle} className="h-7 px-2 font-body">
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditingTitle(false); setTitleDraft(packet.title); }}
                className="h-7 px-2 font-body"
              >
                ✕
              </Button>
            </div>
          ) : (
            <button
              className="text-left font-body text-sm font-semibold hover:underline truncate max-w-full"
              onClick={() => setEditingTitle(true)}
              title="Click to edit title"
            >
              {packet.title}
            </button>
          )}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {packetStatusBadge(packet.status)}
            {packet.packetType && (
              <Badge variant="outline" className="text-xs font-body">{packet.packetType}</Badge>
            )}
            <span className="text-xs text-muted-foreground font-body">
              {linkedPages.length} page{linkedPages.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="flex gap-1 flex-shrink-0">
          {packet.status !== "approved" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleApprove}
              disabled={patchPacket.isPending}
              className="h-7 px-2 font-body text-green-700 border-green-300 hover:bg-green-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {packet.status !== "rejected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              disabled={patchPacket.isPending}
              className="h-7 px-2 font-body text-red-700 border-red-300 hover:bg-red-50"
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {(packet.primaryCompanyOrOrg || packet.primaryPersonName) && (
        <p className="font-body text-xs text-muted-foreground">
          {[packet.primaryCompanyOrOrg, packet.primaryPersonName].filter(Boolean).join(" · ")}
          {packet.detectedYear && ` · ${packet.detectedYear}`}
        </p>
      )}

      {linkedPages.length > 0 && (
        <div className="space-y-1 pt-1">
          {linkedPages.map((page) => {
            const pp = (packet.pages ?? []).find((x) => x.pageId === page.id);
            return (
              <div
                key={page.id}
                className="flex items-center gap-2 text-xs font-body text-muted-foreground"
              >
                <FileText className="h-3 w-3 flex-shrink-0" />
                <span className="flex-1 truncate">
                  p.{page.pageNumber}
                  {page.detectedDocType ? ` · ${page.detectedDocType}` : ""}
                  {pp ? ` (${pp.relationshipType})` : ""}
                </span>
                <button
                  onClick={() => handleDetach(page.id)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Detach page from packet"
                >
                  <Unlink className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create packet dialog
// ─────────────────────────────────────────────────────────────────────────────

interface CreatePacketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPageIds: string[];
  uploadId: string;
  orgId: string;
}

function CreatePacketDialog({
  open,
  onOpenChange,
  selectedPageIds,
  uploadId,
  orgId,
}: CreatePacketDialogProps) {
  const [title, setTitle] = useState("");
  const [packetType, setPacketType] = useState("");
  const createPacket = useCreatePacket(uploadId);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Packet title is required");
      return;
    }
    try {
      await createPacket.mutateAsync({
        orgId,
        originalUploadId: uploadId,
        title: title.trim(),
        packetType: packetType.trim() || undefined,
        pageIds: selectedPageIds,
      });
      toast.success("Packet created");
      setTitle("");
      setPacketType("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create packet");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">Create packet</DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Group {selectedPageIds.length} selected page{selectedPageIds.length !== 1 ? "s" : ""} into a new packet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1">
            <Label className="text-sm font-body">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Invoice — ACME Corp — Jan 2024"
              className="font-body"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm font-body">Type (optional)</Label>
            <Input
              value={packetType}
              onChange={(e) => setPacketType(e.target.value)}
              placeholder="invoice, grant, payroll…"
              className="font-body"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="font-body">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createPacket.isPending} className="font-body">
              {createPacket.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating…
                </>
              ) : (
                "Create packet"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function PageFirstReview() {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();

  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [createPacketOpen, setCreatePacketOpen] = useState(false);

  const {
    data: pages,
    isLoading: pagesLoading,
    isError: pagesError,
    error: pagesErrorObj,
  } = useUploadPages(uploadId);

  const {
    data: packets,
    isLoading: packetsLoading,
    isError: packetsError,
  } = useUploadPackets(uploadId);

  const regroup = useRegroupUpload(uploadId ?? "");

  // Feature flag guard
  if (!PAGE_FIRST_INTAKE_ENABLED) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3 px-4">
          <AlertTriangle className="h-10 w-10 text-orange-500 mx-auto" />
          <h1 className="font-display text-xl font-bold">Page-first intake is disabled</h1>
          <p className="font-body text-sm text-muted-foreground max-w-sm">
            Set <code>VITE_COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE=true</code> to enable this feature.
          </p>
          <Button onClick={() => navigate("/")} className="font-body">Back to library</Button>
        </div>
      </div>
    );
  }

  if (!uploadId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="font-display text-xl font-bold">Invalid upload ID</h1>
          <Button onClick={() => navigate("/")} className="font-body">Back to library</Button>
        </div>
      </div>
    );
  }

  const togglePageSelect = (pageId: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const handleRegroup = async () => {
    try {
      await regroup.mutateAsync();
      toast.success("Packets regrouped from current page labels");
    } catch {
      toast.error("Regroup failed. Please try again.");
    }
  };

  const approvedCount = (packets ?? []).filter((p) => p.status === "approved").length;
  const pendingCount = (packets ?? []).filter((p) => p.status === "suggested").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container max-w-7xl py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate("/")} className="font-body">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Library
            </Button>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight">Page Review</h1>
              <p className="font-body text-xs text-muted-foreground">
                Upload <code className="text-xs bg-muted px-1 rounded">{uploadId}</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedPageIds.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCreatePacketOpen(true)}
                className="font-body gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Create packet ({selectedPageIds.size})
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegroup}
              disabled={regroup.isPending}
              className="font-body gap-1"
            >
              {regroup.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regroup
            </Button>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Pages column ── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Pages
                {pages && (
                  <Badge variant="secondary" className="font-body">
                    {pages.length}
                  </Badge>
                )}
              </h2>
              {selectedPageIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPageIds(new Set())}
                  className="text-xs font-body text-muted-foreground"
                >
                  Clear selection
                </Button>
              )}
            </div>

            {pagesLoading && (
              <div className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin mx-auto mb-3" />
                <p className="font-body text-sm">Loading pages…</p>
              </div>
            )}

            {pagesError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="font-body text-sm text-destructive">
                  {pagesErrorObj instanceof Error ? pagesErrorObj.message : "Failed to load pages."}
                </p>
              </div>
            )}

            {!pagesLoading && !pagesError && pages && pages.length === 0 && (
              <div className="py-12 text-center text-muted-foreground space-y-2">
                <Loader2 className="h-7 w-7 animate-spin mx-auto mb-2" />
                <p className="font-body text-sm font-medium">Upload is processing</p>
                <p className="font-body text-xs">
                  Pages will appear here once the document has been split and labeled.
                </p>
              </div>
            )}

            {!pagesLoading && !pagesError && pages && pages.length > 0 && (
              <div className="space-y-2">
                {pages.map((page) => (
                  <PageRow
                    key={page.id}
                    page={page}
                    uploadId={uploadId}
                    selected={selectedPageIds.has(page.id)}
                    onToggleSelect={togglePageSelect}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Packets column ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Packets
                {packets && (
                  <Badge variant="secondary" className="font-body">
                    {packets.length}
                  </Badge>
                )}
              </h2>
            </div>

            {/* Summary */}
            {packets && packets.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex gap-4 text-xs font-body">
                <span className="text-green-700">✓ {approvedCount} approved</span>
                <span className="text-muted-foreground">○ {pendingCount} pending</span>
              </div>
            )}

            {packetsLoading && (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="font-body text-sm">Loading packets…</p>
              </div>
            )}

            {packetsError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="font-body text-sm text-destructive">Failed to load packets.</p>
              </div>
            )}

            {!packetsLoading && !packetsError && packets && packets.length === 0 && (
              <div className="py-8 text-center text-muted-foreground space-y-2">
                <Layers className="h-7 w-7 mx-auto" />
                <p className="font-body text-sm">No packets yet.</p>
                <p className="font-body text-xs">
                  Select pages and create a packet, or click Regroup to auto-suggest groupings.
                </p>
              </div>
            )}

            {!packetsLoading && !packetsError && packets && packets.length > 0 && (
              <div className="space-y-3">
                {packets.map((packet) => (
                  <PacketCard
                    key={packet.id}
                    packet={packet}
                    uploadId={uploadId}
                    pages={pages ?? []}
                  />
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full font-body gap-1"
              onClick={() => setCreatePacketOpen(true)}
              disabled={selectedPageIds.size === 0}
            >
              <Plus className="h-3.5 w-3.5" />
              {selectedPageIds.size > 0
                ? `Create packet from ${selectedPageIds.size} page${selectedPageIds.size !== 1 ? "s" : ""}`
                : "Select pages to create a packet"}
            </Button>

            <div className="pt-2 border-t border-border">
              <Link
                to="/documents/search"
                className="font-body text-xs text-primary hover:underline"
              >
                Search all documents →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Create packet dialog */}
      <CreatePacketDialog
        open={createPacketOpen}
        onOpenChange={setCreatePacketOpen}
        selectedPageIds={Array.from(selectedPageIds)}
        uploadId={uploadId}
        orgId={pages?.[0]?.orgId ?? ""}
      />
    </div>
  );
}
