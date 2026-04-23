import { useEffect, useMemo, useState } from "react";
import { FileText, Calendar, User, Tag, Download, Sparkles, ExternalLink, Clock, Info, AlertTriangle, Shield, Copy, Trash2, Brain, RefreshCw, ScanSearch } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProcessingStatusBadge from "@/components/ProcessingStatusBadge";
import type { ArchiveDocument } from "@/types/document";
import { MONTH_NAMES } from "@/types/document";
import { downloadDocument, openOriginalDocument } from "@/lib/documentActions";
import { toast } from "sonner";
import { apiRetryWithType } from "@/services/apiDocuments";
import { useDocumentTypes } from "@/hooks/useDocuments";
import type { ChronicleDocumentType } from "@/types/document";

interface DocumentDetailProps {
  document: ArchiveDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentUpdated?: (document: ArchiveDocument) => void;
  canDelete?: boolean;
  isDeleting?: boolean;
  onDelete?: (documentId: string) => void;
}

/** Format an intake source for display */
function formatIntakeSource(source: string): string {
  return source
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const DocumentDetail = ({
  document,
  open,
  onOpenChange,
  onDocumentUpdated,
  canDelete = false,
  isDeleting = false,
  onDelete,
}: DocumentDetailProps) => {
  const [localDocument, setLocalDocument] = useState<ArchiveDocument | null>(document);
  const [rerunType, setRerunType] = useState<string>("unknown_document");
  const [isRerunning, setIsRerunning] = useState(false);

  const { data: docTypes = [] } = useDocumentTypes();

  useEffect(() => {
    setLocalDocument(document);
    setRerunType(document?.documentType ?? document?.extraction?.documentType ?? "unknown_document");
  }, [document]);

  const structuredExtractionFields = useMemo(
    () => localDocument?.extraction?.extractedData ?? {},
    [localDocument?.extraction?.extractedData],
  );

  if (!localDocument) return null;

  const activeDocument = localDocument;

  const canOpenFile = Boolean(activeDocument.fileUrl);

  const handleDownload = async () => {
    const ok = await downloadDocument(activeDocument.fileUrl, activeDocument.originalFileName ?? activeDocument.title);
    if (!ok) {
      toast.error("No file is available to download for this record.");
    }
  };

  const handleOpenOriginal = async () => {
    const ok = await openOriginalDocument(activeDocument.fileUrl);
    if (!ok) {
      const downloaded = await downloadDocument(activeDocument.fileUrl, activeDocument.originalFileName ?? activeDocument.title);
      if (downloaded) {
        toast.warning("Could not open inline preview. Downloaded the original file instead.");
        return;
      }
      toast.error("Unable to open the original file. Verify file availability and authentication.");
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    const confirmed = window.confirm(
      `Delete \"${activeDocument.title}\"? This removes the document record and stored file.`
    );
    if (!confirmed) return;
    onDelete(activeDocument.id);
  };

  const handleRerunExtraction = async () => {
    if (!activeDocument.fileUrl) {
      toast.error("Cannot re-run extraction without an attached file.");
      return;
    }

    setIsRerunning(true);
    try {
      const override = rerunType === "unknown_document" ? undefined : rerunType;
      const result = await apiRetryWithType(activeDocument.id, {
        overrideDocumentType: override,
        saveAsTraining: Boolean(override),
      });

      setLocalDocument(result.document);
      onDocumentUpdated?.(result.document);

      const confidencePct = Math.round((result.prediction.confidence ?? 0) * 100);
      if (result.routeDecision === "manual_override") {
        toast.success(`Re-run queued with manual type '${result.selectedType}'.${result.trainingSaved ? " Training evidence saved." : ""}`);
      } else if (result.routeDecision === "auto_high_confidence") {
        toast.success(`Re-run queued with auto-detected type '${result.selectedType}' (${confidencePct}% confidence).`);
      } else {
        toast.warning(`Re-run queued to fallback type '${result.selectedType}' (${confidencePct}% confidence). Review may be required.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to re-run extraction.";
      toast.error(message);
    } finally {
      setIsRerunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-bold text-foreground leading-tight">
                {activeDocument.title}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {activeDocument.month
                    ? `${MONTH_NAMES[activeDocument.month - 1]} ${activeDocument.year}`
                    : activeDocument.year}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {activeDocument.author}
                </span>
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  {activeDocument.type}
                </span>
                <ProcessingStatusBadge status={activeDocument.processingStatus} lifecycleStatus={activeDocument.status} />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Description */}
          <div>
            <h4 className="font-display text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">
              Description
            </h4>
            <p className="text-muted-foreground font-body leading-relaxed">
              {activeDocument.description}
            </p>
          </div>

          {/* Financial Classification */}
          {(activeDocument.financialCategory || activeDocument.financialDocumentType) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-display text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2 uppercase tracking-wider">
                Financial Classification
              </h4>
              <div className="flex flex-wrap gap-2">
                {activeDocument.financialCategory && (
                  <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    {activeDocument.financialCategory}
                  </Badge>
                )}
                {activeDocument.financialDocumentType && (
                  <Badge variant="outline" className="border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400">
                    {activeDocument.financialDocumentType}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* AI Summary */}
          {activeDocument.aiSummary && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-accent" />
                <h4 className="font-display text-sm font-semibold text-accent uppercase tracking-wider">
                  AI Summary
                </h4>
              </div>
              <p className="text-foreground font-body leading-relaxed text-sm">
                {activeDocument.aiSummary}
              </p>
            </div>
          )}

          {/* Intake Result — visible while extraction is pending or when type confirmation is needed */}
          {activeDocument.extraction?.typePrediction &&
            (activeDocument.processingStatus === "intake_complete" ||
              activeDocument.extraction?.status === "intake_complete" ||
              activeDocument.extraction?.routeDecision === "confirmation_required" ||
              activeDocument.extraction?.routeDecision === "unknown_waiting_for_type") && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ScanSearch className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-display text-sm font-semibold text-indigo-800 dark:text-indigo-200 uppercase tracking-wider flex-1">
                  Intake Prediction
                </h4>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    activeDocument.extraction.typePrediction.confidenceBand === "high"
                      ? "border-green-400 text-green-700 dark:text-green-400"
                      : activeDocument.extraction.typePrediction.confidenceBand === "medium"
                        ? "border-yellow-400 text-yellow-700 dark:text-yellow-400"
                        : "border-red-400 text-red-700 dark:text-red-400"
                  }`}
                >
                  {activeDocument.extraction.typePrediction.confidenceBand} confidence
                </Badge>
              </div>
              <div className="text-sm space-y-1.5">
                <p className="text-muted-foreground">
                  Predicted type:{" "}
                  <span className="text-foreground font-medium capitalize">
                    {activeDocument.extraction.typePrediction.predictedType.replace(/_/g, " ")}
                  </span>
                  {" "}({Math.round(activeDocument.extraction.typePrediction.confidence * 100)}%)
                </p>
                {activeDocument.extraction.routeDecision && (
                  <p className="text-xs text-muted-foreground">
                    Route:{" "}
                    <span className="text-foreground font-medium">
                      {activeDocument.extraction.routeDecision.replace(/_/g, " ")}
                    </span>
                  </p>
                )}
                {activeDocument.extraction.typePrediction.candidates &&
                  activeDocument.extraction.typePrediction.candidates.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Alternatives:{" "}
                      {activeDocument.extraction.typePrediction.candidates
                        .slice(0, 3)
                        .map((c) => `${c.type.replace(/_/g, " ")} (${Math.round(c.confidence * 100)}%)`)
                        .join(" \u2022 ")}
                    </p>
                  )}
              </div>
              {activeDocument.extraction.typePrediction.confidenceBand !== "high" && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                  {activeDocument.extraction?.routeDecision === "confirmation_required" || activeDocument.extraction?.routeDecision === "unknown_waiting_for_type"
                    ? "Type confirmation required \u2014 use \u201cRun with Type\u201d below to assign the correct type and reprocess."
                    : activeDocument.extraction.typePrediction.confidenceBand === "medium"
                      ? "Medium confidence \u2014 full extraction is running to refine the type."
                      : "Low confidence \u2014 consider using \u201cRun with Type\u201d below to set the document type manually."}
                </p>
              )}
            </div>
          )}

          {/* Extraction Status */}
          {activeDocument.extraction && (
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">
                  Extraction Details
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm font-body">
                <div className="text-muted-foreground">
                  Status: <span className="text-foreground font-medium">{activeDocument.extraction.status}</span>
                </div>
                {activeDocument.extraction.method && (
                  <div className="text-muted-foreground">
                    Method: <span className="text-foreground font-medium">{activeDocument.extraction.method}</span>
                  </div>
                )}
                {activeDocument.extraction.confidence != null && (
                  <div className="text-muted-foreground">
                    Confidence: <span className={`font-medium ${activeDocument.extraction.confidence >= 0.7 ? "text-green-600" : activeDocument.extraction.confidence >= 0.4 ? "text-yellow-600" : "text-red-600"}`}>
                      {(activeDocument.extraction.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {activeDocument.extraction.pageCount != null && (
                  <div className="text-muted-foreground">
                    Pages: <span className="text-foreground font-medium">{activeDocument.extraction.pageCount}</span>
                  </div>
                )}
                {activeDocument.extraction.extractedAt && (
                  <div className="text-muted-foreground col-span-2">
                    Extracted: <span className="text-foreground/60">{new Date(activeDocument.extraction.extractedAt).toLocaleString()}</span>
                  </div>
                )}
                {activeDocument.extraction.documentType && (
                  <div className="text-muted-foreground">
                    Detected Type: <span className="text-foreground font-medium">{activeDocument.extraction.documentType}</span>
                  </div>
                )}
                {activeDocument.extraction.schemaUsed && (
                  <div className="text-muted-foreground">
                    Schema Used: <span className="text-foreground font-medium">{activeDocument.extraction.schemaUsed}</span>
                  </div>
                )}
              </div>
              {activeDocument.extraction.warningMessages && activeDocument.extraction.warningMessages.length > 0 && (
                <div className="mt-2 space-y-1">
                  {activeDocument.extraction.warningMessages.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-yellow-600">
                      <AlertTriangle className="h-3 w-3" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
              {activeDocument.extraction.errorMessage && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  {activeDocument.extraction.errorMessage}
                </div>
              )}

              {activeDocument.extraction.typePrediction && (
                <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground space-y-1">
                  <p className="uppercase tracking-wider">Pre-Extraction Type Prediction</p>
                  <p>
                    Predicted: <span className="text-foreground font-medium">{activeDocument.extraction.typePrediction.predictedType}</span>
                    {" "}({Math.round((activeDocument.extraction.typePrediction.confidence ?? 0) * 100)}% \u2022 {activeDocument.extraction.typePrediction.confidenceBand})
                  </p>
                  {activeDocument.extraction.typePrediction.sourceName && (
                    <p>Source clue: <span className="text-foreground">{activeDocument.extraction.typePrediction.sourceName}</span></p>
                  )}
                  {activeDocument.extraction.routeDecision && (
                    <p>Route: <span className="text-foreground font-medium">{activeDocument.extraction.routeDecision.replace(/_/g, " ")}</span></p>
                  )}
                  {activeDocument.extraction.typePrediction.candidates?.length > 0 && (
                    <p>
                      Candidates: {activeDocument.extraction.typePrediction.candidates
                        .slice(0, 3)
                        .map((c) => `${c.type} (${Math.round(c.confidence * 100)}%)`)
                        .join(" \u2022 ")}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-3 border-t border-border pt-3 space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Re-run Extraction</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                    value={rerunType}
                    onChange={(e) => setRerunType(e.target.value)}
                    disabled={isRerunning}
                  >
                    <option value="unknown_document">Auto-detect type</option>
                    {(docTypes as ChronicleDocumentType[]).filter((t) => t.active && t.key !== "unknown_document").map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={handleRerunExtraction} disabled={isRerunning || !canOpenFile}>
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRerunning ? "animate-spin" : ""}`} />
                    {isRerunning ? "Running..." : "Run with Type"}
                  </Button>
                </div>
              </div>

              {Object.keys(structuredExtractionFields).length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Structured Fields</p>
                  <pre className="text-xs overflow-auto max-h-56 bg-muted p-3 rounded-md">{JSON.stringify(structuredExtractionFields, null, 2)}</pre>
                </div>
              )}

              {activeDocument.extraction.rawExtractionResponse && (
                <details className="mt-3">
                  <summary className="text-xs text-primary cursor-pointer hover:underline">View raw extraction JSON</summary>
                  <pre className="text-xs overflow-auto max-h-56 bg-muted p-3 rounded-md mt-2">{JSON.stringify(activeDocument.extraction.rawExtractionResponse, null, 2)}</pre>
                </details>
              )}

              {activeDocument.extraction.rawParsedText && (
                <details className="mt-3">
                  <summary className="text-xs text-primary cursor-pointer hover:underline">View raw parsed text</summary>
                  <pre className="text-xs overflow-auto max-h-56 bg-muted p-3 rounded-md mt-2 whitespace-pre-wrap">{activeDocument.extraction.rawParsedText}</pre>
                </details>
              )}
            </div>
          )}

          {/* AI Document Classification */}
          {activeDocument.classificationResult && (
            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <h4 className="font-display text-sm font-semibold text-violet-800 dark:text-violet-200 uppercase tracking-wider">
                  Document Classification
                </h4>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-800 text-violet-600 dark:text-violet-300 font-body">
                  {(activeDocument.classificationResult.coreApi?.status === "complete" ||
                    activeDocument.classificationResult.llamaCloud?.status === "complete")
                    ? "AI · Core API"
                    : "Rule-based"}
                </span>
              </div>

              {/* Primary result row */}
              {(() => {
                const ai = activeDocument.classificationResult.coreApi ?? activeDocument.classificationResult.llamaCloud;
                const useAi = ai?.status === "complete" && ai.documentType !== "uncategorized";
                const displayType = useAi
                  ? ai.documentType
                  : activeDocument.classificationResult.documentType ?? activeDocument.type;
                const displayConfidence = useAi
                  ? ai.confidence
                  : activeDocument.classificationResult.confidence;
                const confidenceClass =
                  (displayConfidence ?? 0) >= 0.85
                    ? "text-green-600 dark:text-green-400"
                    : (displayConfidence ?? 0) >= 0.6
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400";

                return (
                  <div className="grid grid-cols-2 gap-2 text-sm font-body mb-2">
                    <div className="text-muted-foreground">
                      Document Type:{" "}
                      <span className="text-foreground font-medium capitalize">
                        {displayType?.replace(/_/g, " ") ?? "Unknown"}
                      </span>
                    </div>
                    {displayConfidence != null && (
                      <div className="text-muted-foreground">
                        Confidence:{" "}
                        <span className={`font-medium ${confidenceClass}`}>
                          {(displayConfidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {ai && (
                      <div className="text-muted-foreground">
                        Status:{" "}
                        <span className="text-foreground font-medium capitalize">{ai.status}</span>
                      </div>
                    )}
                    {(ai?.decision ?? activeDocument.classificationResult.decision) && (
                      <div className="text-muted-foreground">
                        Decision:{" "}
                        <span className={`font-medium capitalize ${(ai?.decision ?? activeDocument.classificationResult.decision) === "auto_accepted" ? "text-green-600 dark:text-green-400" : (ai?.decision ?? activeDocument.classificationResult.decision) === "needs_review" ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                          {(ai?.decision ?? activeDocument.classificationResult.decision)?.replace(/_/g, " ")}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Llama Cloud reasoning — expandable */}
              {(activeDocument.classificationResult.coreApi?.reasoning ||
                activeDocument.classificationResult.llamaCloud?.reasoning ||
                activeDocument.classificationResult.reasoning) && (
                <details className="mt-1">
                  <summary className="text-xs text-violet-600 dark:text-violet-400 cursor-pointer hover:underline font-body select-none">
                    View AI reasoning
                  </summary>
                  <p className="mt-1.5 text-xs text-muted-foreground font-body leading-relaxed bg-violet-50/50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800 rounded p-2">
                    {activeDocument.classificationResult.coreApi?.reasoning ??
                      activeDocument.classificationResult.llamaCloud?.reasoning ??
                      activeDocument.classificationResult.reasoning}
                  </p>
                </details>
              )}

              {/* Skipped / failed notice */}
              {(activeDocument.classificationResult.coreApi?.status ?? activeDocument.classificationResult.llamaCloud?.status) === "skipped" && (
                <p className="text-xs text-muted-foreground font-body mt-1">
                  AI classification was skipped for this file type.
                </p>
              )}
              {(activeDocument.classificationResult.coreApi?.status ?? activeDocument.classificationResult.llamaCloud?.status) === "failed" && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  AI classification failed — using rule-based type
                </div>
              )}
            </div>
          )}

          {/* Duplicate Check */}
          {activeDocument.duplicateCheck && activeDocument.duplicateCheck.duplicateStatus !== "unique" && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Copy className="h-4 w-4 text-yellow-600" />
                <h4 className="font-display text-sm font-semibold text-yellow-800 dark:text-yellow-200 uppercase tracking-wider">
                  Possible Duplicate
                </h4>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 font-body">
                This document may be a duplicate of {activeDocument.duplicateCheck.possibleDuplicateIds?.length ?? 0} other document(s).
              </p>
            </div>
          )}

          {/* Review Status */}
          {activeDocument.review?.required && !activeDocument.review?.resolution && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <h4 className="font-display text-sm font-semibold text-orange-800 dark:text-orange-200 uppercase tracking-wider">
                  Review Required
                </h4>
                {activeDocument.review.priority && (
                  <Badge variant="outline" className="text-xs">
                    {activeDocument.review.priority}
                  </Badge>
                )}
              </div>
              {activeDocument.review.reason && activeDocument.review.reason.length > 0 && (
                <ul className="text-sm text-orange-700 dark:text-orange-300 font-body list-disc pl-4 space-y-0.5">
                  {activeDocument.review.reason.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {activeDocument.review?.resolution && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="font-display text-sm font-semibold text-green-800 dark:text-green-200 uppercase tracking-wider">
                  Reviewed
                </span>
                <Badge variant="outline" className="text-xs">{activeDocument.review.resolution}</Badge>
              </div>
              {activeDocument.review.notes && (
                <p className="text-sm text-green-700 dark:text-green-300 font-body mt-1">{activeDocument.review.notes}</p>
              )}
            </div>
          )}

          {/* Extracted Text Preview */}
          {activeDocument.extractedText && activeDocument.extractedText.length > 0 && (
            <div>
              <h4 className="font-display text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">
                Extracted Text
              </h4>
              <div className="bg-muted/50 border border-border rounded-lg p-4 max-h-40 overflow-y-auto">
                <p className="text-sm text-muted-foreground font-body whitespace-pre-wrap">
                  {activeDocument.extractedText.slice(0, 1000)}
                  {activeDocument.extractedText.length > 1000 && "..."}
                </p>
              </div>
            </div>
          )}

          {/* Keywords & Tags */}
          <div>
            <h4 className="font-display text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">
              Tags & Keywords
            </h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs font-body font-medium">
                {activeDocument.category}
              </Badge>
              {activeDocument.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs font-body text-muted-foreground">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Document Metadata */}
          <div>
            <h4 className="font-display text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">
              Metadata
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm font-body">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                Source: {formatIntakeSource(activeDocument.intakeSource)}
              </div>
              {activeDocument.originalFileName && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {activeDocument.originalFileName}
                </div>
              )}
              {activeDocument.fileSize && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  {(activeDocument.fileSize / 1024).toFixed(1)} KB
                </div>
              )}
              {activeDocument.department && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  Dept: {activeDocument.department}
                </div>
              )}
              {activeDocument.extractedMetadata?.wordCount && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  {activeDocument.extractedMetadata.wordCount} words
                </div>
              )}
              {activeDocument.ocrStatus !== "not_needed" && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  Text Processing: {activeDocument.ocrStatus}
                </div>
              )}
            </div>
          </div>

          {/* Processing History */}
          {activeDocument.processingHistory.length > 0 && (
            <div>
              <h4 className="font-display text-sm font-semibold text-foreground mb-2 uppercase tracking-wider">
                Processing History
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {activeDocument.processingHistory.map((event, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-muted-foreground font-body"
                  >
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <span className="text-foreground/60">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                    <span>{event.details || event.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              className="gap-2 font-body bg-primary hover:bg-primary/90"
              onClick={handleDownload}
              disabled={!canOpenFile}
            >
              <Download className="h-4 w-4" />
              Download Document
            </Button>
            <Button
              variant="outline"
              className="gap-2 font-body"
              onClick={handleOpenOriginal}
              disabled={!canOpenFile}
            >
              <ExternalLink className="h-4 w-4" />
              Open Original
            </Button>
            {canDelete && (
              <Button
                variant="destructive"
                className="gap-2 font-body ml-auto"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentDetail;
