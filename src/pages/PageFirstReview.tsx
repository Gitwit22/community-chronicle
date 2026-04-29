/**
 * PageFirstReview — Page-First Intake Review Screen
 *
 * Accessible at: /documents/page-first/review/:uploadId
 *
 * Shows all DocumentPage records for a given OriginalUpload and the
 * suggested DocumentPackets.  Users can:
 *   - Approve / edit page labels
 *   - Create / edit / delete packets
 *   - Attach or detach pages from packets
 *   - Re-run the grouping engine
 *
 * Feature flag: COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE
 * When the flag is not "true" this page shows a disabled-state banner.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  RefreshCw,
  Plus,
  Link2,
  Unlink2,
  FileText,
  Layers,
  HelpCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

import {
  apiGetUploadPages,
  apiGetUploadPackets,
  apiPatchPageLabels,
  apiCreatePacket,
  apiPatchPacket,
  apiAttachPageToPacket,
  apiDetachPageFromPacket,
  apiRegroupUpload,
} from "@/services/apiPageFirstIntake";
import type {
  DocumentPage,
  DocumentPacket,
  PatchPageLabelsRequest,
} from "@/types/pageFirstIntake";

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_FIRST_ENABLED =
  (import.meta.env.VITE_COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE as string | undefined) === "true";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DOC_TYPE_OPTIONS = [
  "invoice",
  "receipt",
  "voucher",
  "check",
  "deposit_summary",
  "payroll",
  "grant",
  "donation",
  "bank_statement",
  "minutes",
  "sign_in_sheet",
  "letter",
  "report",
  "form",
  "tax",
  "contract",
  "other",
];

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const YEAR_MIN = 2000;
const YEAR_MAX = 2099;

// ─────────────────────────────────────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const variant =
    pct >= 70 ? "default" :
    pct >= 40 ? "secondary" :
    "destructive";
  return <Badge variant={variant}>{pct}%</Badge>;
}

function ReviewBadge({ needsReview }: { needsReview: boolean }) {
  if (!needsReview) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-xs">OK</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-600">
      <AlertTriangle className="h-4 w-4" />
      <span className="text-xs">Review</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Label Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface EditLabelDialogProps {
  page: DocumentPage | null;
  packets: DocumentPacket[];
  onClose: () => void;
  onSave: (pageId: string, updates: PatchPageLabelsRequest) => void;
  onAttach: (pageId: string, packetId: string) => void;
}

function EditLabelDialog({
  page,
  packets,
  onClose,
  onSave,
  onAttach,
}: EditLabelDialogProps) {
  const [form, setForm] = useState<PatchPageLabelsRequest>(() => ({
    detectedDocType: page?.detectedDocType ?? null,
    detectedCompanyOrOrg: page?.detectedCompanyOrOrg ?? null,
    detectedPersonName: page?.detectedPersonName ?? null,
    detectedMonth: page?.detectedMonth ?? null,
    detectedYear: page?.detectedYear ?? null,
    detectedDate: page?.detectedDate ?? null,
    needsReview: page?.needsReview ?? false,
  }));
  const [attachTo, setAttachTo] = useState("");

  // Reset form whenever the target page changes.
  // We intentionally depend on page.id only — we reset when a different page
  // is opened, not on every background re-fetch of the same page.
  const pageId = page?.id;
  useEffect(() => {
    if (!page) return;
    setForm({
      detectedDocType: page.detectedDocType ?? null,
      detectedCompanyOrOrg: page.detectedCompanyOrOrg ?? null,
      detectedPersonName: page.detectedPersonName ?? null,
      detectedMonth: page.detectedMonth ?? null,
      detectedYear: page.detectedYear ?? null,
      detectedDate: page.detectedDate ?? null,
      needsReview: page.needsReview,
    });
    setAttachTo("");
  }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!page) return null;

  const current = form;

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Labels — Page {page.pageNumber}</DialogTitle>
          <DialogDescription>
            Update the detected metadata for this page. Changes are saved immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Doc type */}
          <div className="space-y-1">
            <Label>Document Type</Label>
            <Select
              value={current.detectedDocType ?? ""}
              onValueChange={(v) => setForm((f) => ({ ...f, detectedDocType: v || null }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="— unknown —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— unknown —</SelectItem>
                {DOC_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Company / Org */}
          <div className="space-y-1">
            <Label>Company / Organization</Label>
            <Input
              value={current.detectedCompanyOrOrg ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, detectedCompanyOrOrg: e.target.value || null }))}
              placeholder="Organization name"
            />
          </div>

          {/* Person */}
          <div className="space-y-1">
            <Label>Person / Customer / Donor</Label>
            <Input
              value={current.detectedPersonName ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, detectedPersonName: e.target.value || null }))}
              placeholder="Person name"
            />
          </div>

          {/* Month / Year */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Month</Label>
              <Select
                value={String(current.detectedMonth ?? "")}
                onValueChange={(v) => setForm((f) => ({ ...f, detectedMonth: v ? Number(v) : null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {MONTH_NAMES.slice(1).map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Year</Label>
              <Input
                type="number"
                value={current.detectedYear ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, detectedYear: e.target.value ? Number(e.target.value) : null }))}
                placeholder="e.g. 2024"
                min={YEAR_MIN}
                max={YEAR_MAX}
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1">
            <Label>Detected Date</Label>
            <Input
              value={current.detectedDate ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, detectedDate: e.target.value || null }))}
              placeholder="e.g. 03/15/2024"
            />
          </div>

          {/* Needs Review */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="needsReview"
              checked={current.needsReview ?? false}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, needsReview: Boolean(checked) }))}
            />
            <Label htmlFor="needsReview">Mark as Needs Review</Label>
          </div>

          {/* Attach to packet */}
          {packets.length > 0 && (
            <div className="space-y-1 border-t pt-4">
              <Label>Attach to Packet</Label>
              <div className="flex gap-2">
                <Select value={attachTo} onValueChange={setAttachTo}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a packet…" />
                  </SelectTrigger>
                  <SelectContent>
                    {packets.map((pk) => (
                      <SelectItem key={pk.id} value={pk.id}>{pk.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="secondary"
                  disabled={!attachTo}
                  onClick={() => { if (attachTo) onAttach(page.id, attachTo); }}
                >
                  Attach
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(page.id, current)}>Save Labels</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Packet Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface CreatePacketDialogProps {
  orgId: string;
  uploadId: string;
  selectedPageIds: string[];
  onClose: () => void;
  onCreate: (title: string, packetType?: string) => void;
}

function CreatePacketDialog({
  selectedPageIds,
  onClose,
  onCreate,
}: CreatePacketDialogProps) {
  const [title, setTitle] = useState("");
  const [packetType, setPacketType] = useState("");

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Packet</DialogTitle>
          <DialogDescription>
            Group {selectedPageIds.length} selected page{selectedPageIds.length !== 1 ? "s" : ""} into a new packet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Packet Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Invoice — ACME Corp — Jan 2024"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Type (optional)</Label>
            <Select value={packetType} onValueChange={setPacketType}>
              <SelectTrigger>
                <SelectValue placeholder="— select type —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">— none —</SelectItem>
                {DOC_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!title.trim()} onClick={() => onCreate(title, packetType || undefined)}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PageFirstReview() {
  const { uploadId } = useParams<{ uploadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingPage, setEditingPage] = useState<DocumentPage | null>(null);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [showCreatePacket, setShowCreatePacket] = useState(false);

  // ── Feature flag guard ────────────────────────────────────────────────────

  if (!PAGE_FIRST_ENABLED) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Page-First Review Not Enabled
            </CardTitle>
            <CardDescription>
              Set{" "}
              <code className="bg-muted px-1 rounded text-xs">
                VITE_COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE=true
              </code>{" "}
              in your environment to enable this feature.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!uploadId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>No Upload ID</CardTitle>
            <CardDescription>
              Navigate to this page with a valid upload ID in the URL:
              <br />
              <code className="text-xs">/documents/page-first/review/:uploadId</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <PageFirstReviewContent uploadId={uploadId} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner content (extracted so hooks always run after guard)
// ─────────────────────────────────────────────────────────────────────────────

function PageFirstReviewContent({ uploadId }: { uploadId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingPage, setEditingPage] = useState<DocumentPage | null>(null);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [showCreatePacket, setShowCreatePacket] = useState(false);

  // ── Data queries ─────────────────────────────────────────────────────────

  const pagesQuery = useQuery({
    queryKey: ["page-first-pages", uploadId],
    queryFn: () => apiGetUploadPages(uploadId),
  });

  const packetsQuery = useQuery({
    queryKey: ["page-first-packets", uploadId],
    queryFn: () => apiGetUploadPackets(uploadId),
  });

  const pages: DocumentPage[] = pagesQuery.data ?? [];
  const packets: DocumentPacket[] = packetsQuery.data ?? [];

  // Build a map from pageId → packet title for the table column
  const pagePacketMap = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const packet of packets) {
      for (const pp of packet.pages ?? []) {
        m.set(pp.pageId, packet.title);
      }
    }
    return m;
  }, [packets]);

  // Derive orgId from first page (needed for packet creation)
  const orgId = pages[0]?.orgId ?? "";

  // ── Mutations ─────────────────────────────────────────────────────────────

  const patchLabelsMutation = useMutation({
    mutationFn: ({ pageId, updates }: { pageId: string; updates: PatchPageLabelsRequest }) =>
      apiPatchPageLabels(pageId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-first-pages", uploadId] });
      setEditingPage(null);
      toast.success("Labels saved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createPacketMutation = useMutation({
    mutationFn: ({ title, packetType }: { title: string; packetType?: string }) =>
      apiCreatePacket({
        orgId,
        originalUploadId: uploadId,
        title,
        packetType,
        pageIds: [...selectedPageIds],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-first-packets", uploadId] });
      setShowCreatePacket(false);
      setSelectedPageIds(new Set());
      toast.success("Packet created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const attachPageMutation = useMutation({
    mutationFn: ({ pageId, packetId }: { pageId: string; packetId: string }) =>
      apiAttachPageToPacket(packetId, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-first-packets", uploadId] });
      toast.success("Page attached to packet.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const detachPageMutation = useMutation({
    mutationFn: ({ pageId, packetId }: { pageId: string; packetId: string }) =>
      apiDetachPageFromPacket(packetId, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-first-packets", uploadId] });
      toast.success("Page detached from packet.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const regroupMutation = useMutation({
    mutationFn: () => apiRegroupUpload(uploadId),
    onSuccess: (newPackets) => {
      queryClient.invalidateQueries({ queryKey: ["page-first-packets", uploadId] });
      toast.success(`Regrouping complete. ${newPackets.length} packet(s) suggested.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approvePageMutation = useMutation({
    mutationFn: (pageId: string) =>
      apiPatchPageLabels(pageId, { needsReview: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-first-pages", uploadId] });
      toast.success("Page approved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const markUnknownMutation = useMutation({
    mutationFn: (pageId: string) =>
      apiPatchPageLabels(pageId, {
        detectedDocType: null,
        detectedCompanyOrOrg: null,
        detectedPersonName: null,
        detectedMonth: null,
        detectedYear: null,
        detectedDate: null,
        needsReview: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-first-pages", uploadId] });
      toast.success("Page marked as unknown.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPageIds(new Set(pages.map((p) => p.id)));
  }, [pages]);

  const clearSelection = useCallback(() => setSelectedPageIds(new Set()), []);

  // ── Render ────────────────────────────────────────────────────────────────

  const isLoading = pagesQuery.isLoading || packetsQuery.isLoading;
  const isError = pagesQuery.isError || packetsQuery.isError;
  const needsReviewCount = pages.filter((p) => p.needsReview).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-screen-xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold leading-tight flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Page-First Review
              </h1>
              <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">{uploadId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {needsReviewCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {needsReviewCount} needs review
              </Badge>
            )}
            <Badge variant="secondary">{pages.length} pages</Badge>
            <Badge variant="outline">{packets.length} packets</Badge>

            {/* In-progress mutation indicators */}
            {patchLabelsMutation.isPending && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving labels…
              </Badge>
            )}
            {createPacketMutation.isPending && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Creating packet…
              </Badge>
            )}

            <Button
              size="sm"
              variant="secondary"
              onClick={() => regroupMutation.mutate()}
              disabled={regroupMutation.isPending || pages.length === 0}
            >
              {regroupMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Rerun Grouping
            </Button>

            {selectedPageIds.size > 0 && (
              <Button
                size="sm"
                onClick={() => setShowCreatePacket(true)}
                disabled={!orgId}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Packet ({selectedPageIds.size})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {isError && (
          <Card>
            <CardContent className="py-8 text-center text-destructive">
              <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-destructive" />
              Failed to load pages or packets for this upload.
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => {
                  pagesQuery.refetch();
                  packetsQuery.refetch();
                }}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state — upload may still be processing */}
        {!isLoading && !isError && pages.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No pages found for this upload.</p>
              <p className="text-xs mt-1 max-w-xs mx-auto">
                The upload may still be processing, or the upload ID is invalid.
                If you just uploaded, wait a moment and refresh.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => pagesQuery.refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pages table */}
        {!isLoading && !isError && pages.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pages</CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  {selectedPageIds.size > 0 ? (
                    <>
                      <span className="text-muted-foreground">{selectedPageIds.size} selected</span>
                      <Button variant="ghost" size="sm" onClick={clearSelection}>Clear</Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={selectAll}>Select all</Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-16">Page #</TableHead>
                    <TableHead>Doc Type</TableHead>
                    <TableHead>Company / Org</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead className="w-20">Month</TableHead>
                    <TableHead className="w-20">Year</TableHead>
                    <TableHead>Packet</TableHead>
                    <TableHead className="w-20">Confidence</TableHead>
                    <TableHead className="w-24">Review</TableHead>
                    <TableHead className="w-40">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page) => {
                    const packetTitle = pagePacketMap.get(page.id);
                    const packetForPage = packetTitle
                      ? packets.find((pk) => pk.title === packetTitle)
                      : undefined;
                    return (
                      <TableRow
                        key={page.id}
                        className={selectedPageIds.has(page.id) ? "bg-muted/50" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedPageIds.has(page.id)}
                            onCheckedChange={() => toggleSelect(page.id)}
                          />
                        </TableCell>

                        <TableCell className="font-mono text-sm">{page.pageNumber}</TableCell>

                        <TableCell>
                          {page.detectedDocType ? (
                            <Badge variant="outline" className="text-xs capitalize">
                              {page.detectedDocType.replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        <TableCell className="max-w-[160px] truncate text-sm">
                          {page.detectedCompanyOrOrg ?? (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        <TableCell className="max-w-[140px] truncate text-sm">
                          {page.detectedPersonName ?? (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-sm">
                          {page.detectedMonth != null
                            ? MONTH_NAMES[page.detectedMonth]
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>

                        <TableCell className="text-sm font-mono">
                          {page.detectedYear ?? (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        <TableCell className="max-w-[160px] truncate text-sm">
                          {packetTitle ? (
                            <span className="text-primary">{packetTitle}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">unassigned</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <ConfidenceBadge confidence={page.confidence} />
                        </TableCell>

                        <TableCell>
                          <ReviewBadge needsReview={page.needsReview} />
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            {/* Edit labels */}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit labels"
                              className="h-7 w-7"
                              onClick={() => setEditingPage(page)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            {/* Approve (clear needs-review) */}
                            {page.needsReview && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Approve — mark as reviewed"
                                className="h-7 w-7 text-green-600"
                                onClick={() => approvePageMutation.mutate(page.id)}
                                disabled={approvePageMutation.isPending}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Detach from packet */}
                            {packetForPage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Detach from packet"
                                className="h-7 w-7 text-destructive"
                                onClick={() =>
                                  detachPageMutation.mutate({
                                    pageId: page.id,
                                    packetId: packetForPage.id,
                                  })
                                }
                                disabled={detachPageMutation.isPending}
                              >
                                <Unlink2 className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Mark unknown */}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Mark as unknown"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={() => markUnknownMutation.mutate(page.id)}
                              disabled={markUnknownMutation.isPending}
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Suggested packets */}
        {!isLoading && !isError && packets.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Suggested Packets
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packets.map((packet) => (
                <PacketCard
                  key={packet.id}
                  packet={packet}
                  pages={pages}
                  onApprove={(packetId) => {
                    apiPatchPacket(packetId, { status: "approved" })
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ["page-first-packets", uploadId] });
                        toast.success("Packet approved.");
                      })
                      .catch((err: Error) => toast.error(err.message));
                  }}
                  onReject={(packetId) => {
                    apiPatchPacket(packetId, { status: "rejected" })
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ["page-first-packets", uploadId] });
                        toast.success("Packet rejected.");
                      })
                      .catch((err: Error) => toast.error(err.message));
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit label dialog */}
      {editingPage && (
        <EditLabelDialog
          page={editingPage}
          packets={packets}
          onClose={() => setEditingPage(null)}
          onSave={(pageId, updates) =>
            patchLabelsMutation.mutate({ pageId, updates })
          }
          onAttach={(pageId, packetId) => {
            attachPageMutation.mutate({ pageId, packetId });
            setEditingPage(null);
          }}
        />
      )}

      {/* Create packet dialog */}
      {showCreatePacket && (
        <CreatePacketDialog
          orgId={orgId}
          uploadId={uploadId}
          selectedPageIds={[...selectedPageIds]}
          onClose={() => setShowCreatePacket(false)}
          onCreate={(title, packetType) =>
            createPacketMutation.mutate({ title, packetType })
          }
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Packet summary card
// ─────────────────────────────────────────────────────────────────────────────

interface PacketCardProps {
  packet: DocumentPacket;
  pages: DocumentPage[];
  onApprove: (packetId: string) => void;
  onReject: (packetId: string) => void;
}

function PacketCard({ packet, pages, onApprove, onReject }: PacketCardProps) {
  const pageCount = packet.pages?.length ?? 0;
  const pageNumbers = (packet.pages ?? [])
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((pp) => {
      const p = pages.find((pg) => pg.id === pp.pageId);
      return p ? p.pageNumber : "?";
    });

  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    suggested: "secondary",
    approved: "default",
    rejected: "destructive",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm leading-snug">{packet.title}</CardTitle>
          <Badge variant={statusVariant[packet.status] ?? "outline"} className="shrink-0 text-xs">
            {packet.status}
          </Badge>
        </div>
        {packet.packetType && (
          <CardDescription className="capitalize text-xs">
            {packet.packetType.replace(/_/g, " ")}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="text-xs space-y-1.5">
        {packet.primaryCompanyOrOrg && (
          <p className="truncate"><span className="text-muted-foreground">Org:</span> {packet.primaryCompanyOrOrg}</p>
        )}
        {packet.primaryPersonName && (
          <p className="truncate"><span className="text-muted-foreground">Person:</span> {packet.primaryPersonName}</p>
        )}
        {(packet.detectedMonth || packet.detectedYear) && (
          <p>
            <span className="text-muted-foreground">Date:</span>{" "}
            {packet.detectedMonth ? MONTH_NAMES[packet.detectedMonth] : ""}
            {packet.detectedMonth && packet.detectedYear ? " " : ""}
            {packet.detectedYear ?? ""}
          </p>
        )}
        <p>
          <span className="text-muted-foreground">Pages:</span>{" "}
          {pageCount > 0
            ? pageNumbers.join(", ")
            : <span className="italic">none</span>}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <ConfidenceBadge confidence={packet.confidence} />
          {packet.needsReview && (
            <span className="text-amber-600 flex items-center gap-0.5">
              <AlertTriangle className="h-3 w-3" />
              <span>Review</span>
            </span>
          )}
        </div>

        {packet.status === "suggested" && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="h-7 text-xs flex-1" onClick={() => onApprove(packet.id)}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Approve
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => onReject(packet.id)}>
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
