/**
 * Review Queue Panel
 *
 * Displays documents that need human review, sorted by priority.
 * Data is sourced directly from GET /api/review-queue — this component does NOT
 * filter from the general document list.
 *
 * Actions (approve / reject / retry) are only rendered for users with
 * reviewer or admin role; uploaders see the queue read-only.
 *
 * Manual-entry records whose only review reason is "missing_file" are
 * suppressed from this queue (they appear in the document list with an
 * "Attach file" indicator instead).
 */

import { Eye, AlertTriangle, CheckCircle2, RefreshCw, Copy, XCircle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProcessingStatusBadge from "@/components/ProcessingStatusBadge";
import type { ArchiveDocument } from "@/types/document";

interface ReviewQueuePanelProps {
  /** Documents returned by GET /api/review-queue — already filtered by backend */
  documents: ArchiveDocument[];
  isLoading?: boolean;
  /** Whether the current user can approve / reject / retry items */
  canResolve: boolean;
  onSelectDocument?: (doc: ArchiveDocument) => void;
  onResolve?: (docId: string, resolution: string) => void;
}

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

/**
 * Returns true when the document is a manual entry stuck solely because it
 * has no file yet. These should not clog the review queue — they belong in
 * the document list with an "Attach file" prompt.
 */
function isManualMissingFileOnly(doc: ArchiveDocument): boolean {
  if (doc.intakeSource !== "manual_entry") return false;
  const reasons = doc.review?.reason ?? [];
  if (reasons.length === 0) return false;
  return reasons.every((r) => r === "missing_file" || r === "no_file" || r === "file_missing");
}

const ReviewQueuePanel = ({
  documents,
  isLoading = false,
  canResolve,
  onSelectDocument,
  onResolve,
}: ReviewQueuePanelProps) => {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="h-10 w-10 text-primary mx-auto mb-4 animate-spin" />
        <h3 className="font-display text-lg text-foreground mb-1">Loading Review Queue</h3>
        <p className="text-sm text-muted-foreground font-body">
          Checking for documents that require manual review.
        </p>
      </div>
    );
  }

  // Filter out manual entries stuck only because of missing file — those
  // belong in the document list with an "Attach file" prompt, not in the
  // review queue.
  const reviewDocs = documents.filter((doc) => !isManualMissingFileOnly(doc));

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...reviewDocs].sort((a, b) => {
    const pa = priorityOrder[a.review?.priority ?? "low"] ?? 2;
    const pb = priorityOrder[b.review?.priority ?? "low"] ?? 2;
    return pa - pb;
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-4" />
        <h3 className="font-display text-lg text-foreground mb-1">Review Queue Empty</h3>
        <p className="text-sm text-muted-foreground font-body">
          All documents have been reviewed or are processing normally.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">
            Review Queue
          </h3>
          <Badge variant="secondary" className="text-xs">{sorted.length}</Badge>
        </div>
        {!canResolve && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
            <Lock className="h-3.5 w-3.5" />
            View only — reviewer role required to approve or reject
          </div>
        )}
      </div>

      {sorted.map((doc) => (
        <div
          key={doc.id}
          className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onSelectDocument?.(doc)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-display text-sm font-semibold text-foreground truncate">
                  {doc.title}
                </h4>
                <ProcessingStatusBadge status={doc.processingStatus} lifecycleStatus={doc.status} />
                {doc.review?.priority && (
                  <Badge className={`text-xs ${priorityColors[doc.review.priority] || ""}`}>
                    {doc.review.priority}
                  </Badge>
                )}
              </div>

              {doc.review?.reason && doc.review.reason.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {doc.review.reason.map((r, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-body"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {r.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground font-body">
                <span>{doc.category}</span>
                {doc.extraction?.confidence != null && (
                  <span>Confidence: {(doc.extraction.confidence * 100).toFixed(0)}%</span>
                )}
                {doc.duplicateCheck?.duplicateStatus === "possible_duplicate" && (
                  <span className="flex items-center gap-1 text-yellow-600">
                    <Copy className="h-3 w-3" />
                    Possible duplicate
                  </span>
                )}
                <span>{doc.intakeSource.replace(/_/g, " ")}</span>
              </div>
            </div>

            {/* Actions — only shown to reviewers and admins */}
            {canResolve && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve?.(doc.id, "approved");
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve?.(doc.id, "reprocessed");
                  }}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve?.(doc.id, "rejected");
                  }}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReviewQueuePanel;
