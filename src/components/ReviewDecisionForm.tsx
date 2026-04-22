/**
 * Review Decision Form
 *
 * Form for resolving a document review with a decision, notes, and optional
 * document type reclassification (Phase 2 — search-first model).
 *
 * When a document is other_unclassified, the form surfaces a type picker so
 * admins can:
 *   1. Assign it to an existing type
 *   2. Create a new custom type on the spot
 *   3. Optionally save the document's patterns as fingerprint hints for future
 *      auto-classification
 */

import { useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Copy, Edit, Tag, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ArchiveDocument, ChronicleDocumentType, ReviewMetadata } from "@/types/document";
import { isDocumentUnclassified } from "@/lib/reviewState";
import { getDocumentTypeLabel } from "@/services/documentTypeClassifier";
import { useDocumentTypes, useReclassifyDocument, useResolveReview } from "@/hooks/useDocuments";

interface ReviewDecisionFormProps {
  document: ArchiveDocument;
  /** @deprecated Pass onDismiss instead; resolve/reclassify are handled internally */
  onResolve?: (docId: string, resolution: ReviewMetadata["resolution"], notes: string) => void;
  onDismiss?: () => void;
  onCancel?: () => void;
}

const resolutionOptions: Array<{
  value: ReviewMetadata["resolution"];
  label: string;
  icon: React.ElementType;
  description: string;
}> = [
  { value: "approved",    label: "Approve",   icon: CheckCircle2, description: "Document is correct as-is" },
  { value: "corrected",   label: "Corrected", icon: Edit,         description: "Metadata has been manually fixed" },
  { value: "reprocessed", label: "Reprocess", icon: RefreshCw,    description: "Re-run extraction and categorization" },
  { value: "duplicate",   label: "Duplicate", icon: Copy,         description: "Confirmed as duplicate" },
  { value: "rejected",    label: "Reject",    icon: XCircle,      description: "Remove from archive" },
];

const ReviewDecisionForm = ({ document, onResolve, onDismiss, onCancel }: ReviewDecisionFormProps) => {
  const [selectedResolution, setSelectedResolution] = useState<ReviewMetadata["resolution"]>();
  const [notes, setNotes] = useState("");

  // Reclassification state (shown when doc is other_unclassified or user picks "Reclassify" mode)
  const isUnclassified = isDocumentUnclassified(document);

  const [showReclassify, setShowReclassify] = useState(isUnclassified);
  const [selectedType, setSelectedType] = useState<string>(document.documentType ?? "");
  const [saveFingerprint, setSaveFingerprint] = useState(false);
  const [createNewType, setCreateNewType] = useState(false);
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");

  const { data: docTypes = [] } = useDocumentTypes();
  const reclassifyMutation = useReclassifyDocument();
  const resolveMutation = useResolveReview();

  const activeTypes = docTypes.filter((t: ChronicleDocumentType) => t.active && t.key !== "other_unclassified");

  function handleSubmit() {
    if (showReclassify && selectedType && selectedType !== "other_unclassified") {
      // Reclassify path
      reclassifyMutation.mutate(
        {
          docId: document.id,
          documentType: createNewType ? newTypeKey.toLowerCase().replace(/\s+/g, "_") : selectedType,
          notes,
          saveAsFingerprint: saveFingerprint,
          createNewType,
          newTypeLabel: createNewType ? newTypeLabel : undefined,
        },
        {
          onSuccess: () => {
            onDismiss?.();
          },
        },
      );
    } else if (selectedResolution) {
      // Standard resolve path
      if (onResolve) {
        onResolve(document.id, selectedResolution, notes);
      } else {
        resolveMutation.mutate(
          { docId: document.id, resolution: selectedResolution, notes },
          { onSuccess: () => { onDismiss?.(); } },
        );
      }
    }
  }

  const isPending = reclassifyMutation.isPending || resolveMutation.isPending;
  const canSubmit = showReclassify
    ? (createNewType ? !!newTypeKey && !!newTypeLabel : !!selectedType && selectedType !== "other_unclassified")
    : !!selectedResolution;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
          Review: {document.title}
        </h4>
        {isUnclassified && (
          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Unclassified
          </Badge>
        )}
      </div>

      {/* Current type */}
      {document.documentType && (
        <div className="text-xs text-muted-foreground">
          Current type: <span className="font-medium text-foreground">{getDocumentTypeLabel(document.documentType)}</span>
          {document.classificationConfidence != null && (
            <span className="ml-1">({Math.round(document.classificationConfidence * 100)}% confidence)</span>
          )}
        </div>
      )}

      {/* Review reasons */}
      {document.review?.reason && document.review.reason.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {document.review.reason.map((r, i) => (
            <Badge key={i} variant="outline" className="text-xs text-orange-600 border-orange-300">
              {r}
            </Badge>
          ))}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-2 text-sm">
        <button
          className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
            !showReclassify ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
          }`}
          onClick={() => setShowReclassify(false)}
        >
          Standard Review
        </button>
        <button
          className={`px-3 py-1.5 rounded-md border text-xs font-medium flex items-center gap-1 transition-colors ${
            showReclassify ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
          }`}
          onClick={() => setShowReclassify(true)}
        >
          <Tag className="h-3 w-3" />
          Assign Type
        </button>
      </div>

      {showReclassify ? (
        /* ── Reclassification panel ─────────────────────────────────────────── */
        <div className="space-y-3">
          <div>
            <label className="font-body text-xs font-medium text-foreground block mb-1.5">
              Assign document type
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {activeTypes.map((dt: ChronicleDocumentType) => (
                <button
                  key={dt.key}
                  onClick={() => { setSelectedType(dt.key); setCreateNewType(false); }}
                  className={`text-left px-2.5 py-2 rounded-md border text-xs transition-colors ${
                    selectedType === dt.key && !createNewType
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border hover:border-primary/30 text-foreground"
                  }`}
                >
                  {dt.label}
                  {dt.isUserCreated && (
                    <span className="ml-1 text-muted-foreground">(custom)</span>
                  )}
                </button>
              ))}
              {/* New type option */}
              <button
                onClick={() => { setCreateNewType(true); setSelectedType(""); }}
                className={`text-left px-2.5 py-2 rounded-md border text-xs flex items-center gap-1 transition-colors ${
                  createNewType
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-dashed border-border hover:border-primary/30 text-muted-foreground"
                }`}
              >
                <Plus className="h-3 w-3" />
                New custom type…
              </button>
            </div>
          </div>

          {createNewType && (
            <div className="space-y-2 p-3 rounded-md border border-dashed border-primary/30 bg-primary/5">
              <div>
                <label className="font-body text-xs font-medium text-foreground block mb-1">Type key</label>
                <input
                  value={newTypeKey}
                  onChange={(e) => setNewTypeKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  placeholder="e.g. grant_report"
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="font-body text-xs font-medium text-foreground block mb-1">Display label</label>
                <input
                  value={newTypeLabel}
                  onChange={(e) => setNewTypeLabel(e.target.value)}
                  placeholder="e.g. Grant Report"
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>
          )}

          {/* Learn from this document */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveFingerprint}
              onChange={(e) => setSaveFingerprint(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <span className="font-body text-xs font-medium text-foreground">
                Learn from this document
              </span>
              <p className="font-body text-xs text-muted-foreground">
                Save this document as a pattern example so future similar documents auto-classify to this type.
              </p>
            </div>
          </label>
        </div>
      ) : (
        /* ── Standard resolution panel ──────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {resolutionOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedResolution === opt.value;
            return (
              <button
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30 hover:bg-muted/50"
                }`}
                onClick={() => setSelectedResolution(opt.value)}
              >
                <Icon className={`h-4 w-4 mt-0.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="font-body text-sm font-medium text-foreground">{opt.label}</div>
                  <div className="font-body text-xs text-muted-foreground">{opt.description}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="font-body text-sm font-medium text-foreground block mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes about this decision..."
          className="w-full h-20 px-3 py-2 text-sm font-body rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        {(onCancel || onDismiss) && (
          <Button variant="ghost" size="sm" onClick={onCancel ?? onDismiss} className="font-body">
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          disabled={!canSubmit || isPending}
          onClick={handleSubmit}
          className="font-body"
        >
          {isPending ? "Saving…" : showReclassify ? "Assign Type" : "Submit Decision"}
        </Button>
      </div>
    </div>
  );
};

export default ReviewDecisionForm;
