/**
 * Upload Dialog Component
 *
 * Provides multiple document intake methods in a single dialog:
 * - Drag and drop
 * - Single/multi file selection
 * - Folder upload
 * - Scanner import
 */

import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProcessingStatusBadge from "@/components/ProcessingStatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  FolderOpen,
  ScanLine,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Layers,
} from "lucide-react";
import {
  useUploadFile,
  useUploadMultipleFiles,
  useBulkUpload,
  useScannerImport,
  usePageFirstUpload,
} from "@/hooks/useDocuments";
import { PAGE_FIRST_INTAKE_ENABLED } from "@/services/pageFirstUpload";
import { getDocumentTypeLabel } from "@/services/documentTypeClassifier";
import { isDocumentPendingReview } from "@/lib/reviewState";
import type { ArchiveDocument } from "@/types/document";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

/**
 * File types the backend can actually extract text from.
 * Do NOT add DOCX/XLSX/PPTX here until the backend has a real parser for them.
 * Adding them only creates false-positive uploads that fail silently later.
 */
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/bmp",
  "image/webp",
  "text/plain",
  "text/csv",
  "text/html",
  "text/markdown",
]);

/** Extensions accepted by the file input — must match SUPPORTED_MIME_TYPES */
const SUPPORTED_ACCEPT = ".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp,.txt,.csv,.html,.md";

/**
 * MIME types that users might reasonably try to upload but are NOT yet
 * supported. Shown as a clear rejection message instead of silently failing.
 */
const UNSUPPORTED_TYPE_LABELS: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX (Word)",
  "application/msword": "DOC (Word)",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX (Excel)",
  "application/vnd.ms-excel": "XLS (Excel)",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX (PowerPoint)",
  "application/vnd.ms-powerpoint": "PPT (PowerPoint)",
  "application/zip": "ZIP archive",
  "application/x-zip-compressed": "ZIP archive",
};

function classifyFiles(files: File[]): { accepted: File[]; rejected: { name: string; label: string }[] } {
  const accepted: File[] = [];
  const rejected: { name: string; label: string }[] = [];

  for (const file of files) {
    if (SUPPORTED_MIME_TYPES.has(file.type)) {
      accepted.push(file);
      continue;
    }
    const unsupportedLabel = UNSUPPORTED_TYPE_LABELS[file.type];
    if (unsupportedLabel) {
      rejected.push({ name: file.name, label: unsupportedLabel });
    } else {
      // Unknown type — check by extension as fallback
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const knownUnsupported: Record<string, string> = {
        doc: "DOC (Word)", docx: "DOCX (Word)",
        xls: "XLS (Excel)", xlsx: "XLSX (Excel)",
        ppt: "PPT (PowerPoint)", pptx: "PPTX (PowerPoint)",
      };
      if (knownUnsupported[ext]) {
        rejected.push({ name: file.name, label: knownUnsupported[ext] });
      } else {
        // Accept unknown types — backend can reject if truly unsupported
        accepted.push(file);
      }
    }
  }

  return { accepted, rejected };
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UploadDialog = ({ open, onOpenChange }: UploadDialogProps) => {
  const navigate = useNavigate();
  const { organizationId, user } = useAuth();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // Per-file relative paths for folder uploads (webkitRelativePath).
  // Parallel array to selectedFiles — index i in folderPaths corresponds to selectedFiles[i].
  const [folderPaths, setFolderPaths] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<"files" | "folder" | "scanner">("files");
  const [uploadedResults, setUploadedResults] = useState<ArchiveDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  const uploadSingle = useUploadFile();
  const uploadMultiple = useUploadMultipleFiles();
  const bulkUpload = useBulkUpload();
  const scannerImport = useScannerImport();
  const pageFirstUpload = usePageFirstUpload();

  const isUploading =
    uploadSingle.isPending ||
    uploadMultiple.isPending ||
    bulkUpload.isPending ||
    scannerImport.isPending ||
    pageFirstUpload.isPending;

  const showingResults = uploadedResults.length > 0;

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const raw = Array.from(e.dataTransfer.files);
    if (raw.length === 0) return;

    const { accepted, rejected } = classifyFiles(raw);

    if (rejected.length > 0) {
      const names = rejected.map((r) => `"${r.name}" (${r.label})`).join(", ");
      toast.error(
        `${rejected.length === 1 ? "This format is" : "These formats are"} not yet supported: ${names}. Use PDF, images, or plain text.`,
        { duration: 6000 },
      );
    }

    if (accepted.length > 0) {
      setSelectedFiles((prev) => [...prev, ...accepted]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files ? Array.from(e.target.files) : [];
    if (raw.length === 0) return;

    // Scanner mode accepts image/PDF only; we've already constrained via accept attr,
    // but validate again client-side for drag-and-drop and folder picker paths.
    const { accepted, rejected } = uploadMode === "folder" ? { accepted: raw, rejected: [] } : classifyFiles(raw);

    if (rejected.length > 0) {
      const names = rejected.map((r) => `"${r.name}" (${r.label})`).join(", ");
      toast.error(
        `${rejected.length === 1 ? "This format is" : "These formats are"} not yet supported: ${names}. Use PDF, images, or plain text.`,
        { duration: 6000 },
      );
    }

    if (accepted.length === 0) return;

    setSelectedFiles((prev) => [...prev, ...accepted]);

    // Preserve relative paths from folder picker (webkitRelativePath is set
    // by the browser when using webkitdirectory; empty string for regular picks).
    if (uploadMode === "folder") {
      const paths = accepted.map((f) =>
        (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
      );
      setFolderPaths((prev) => [...prev, ...paths]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFolderPaths((prev) => prev.filter((_, i) => i !== index));
  };

  const resetDialogState = () => {
    setSelectedFiles([]);
    setFolderPaths([]);
    setUploadedResults([]);
  };

  const closeDialog = () => {
    resetDialogState();
    onOpenChange(false);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    // ── Page-first intake flow ──────────────────────────────────────────────
    // When enabled, process each file through the page-first pipeline and
    // redirect to the review screen.  Only the "files" tab supports page-first;
    // folder/scanner uploads fall back to the legacy batch endpoint.
    if (PAGE_FIRST_INTAKE_ENABLED && uploadMode === "files" && organizationId) {
      try {
        // Process files one at a time — each becomes its own OriginalUpload.
        // Navigate to the review page for the first (or only) upload.
        let firstUploadId: string | null = null;
        for (const file of selectedFiles) {
          const result = await pageFirstUpload.mutateAsync({
            file,
            orgId: organizationId,
            uploadedById: user?.id,
          });
          if (!firstUploadId) {
            firstUploadId = result.originalUploadId;
          }
        }

        const count = selectedFiles.length;
        toast.success(
          `${count} ${count === 1 ? "document" : "documents"} uploaded — ${
            selectedFiles.reduce((s, f) => s + (f.type === "application/pdf" ? 1 : 0), 0) > 0
              ? "pages extracted and labeled"
              : "queued for review"
          }`,
        );

        closeDialog();

        if (firstUploadId) {
          navigate(`/documents/page-first/review/${firstUploadId}`);
        }
      } catch (error) {
        toast.error(
          `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
      return;
    }

    // ── Legacy upload flow ─────────────────────────────────────────────────
    try {
      let result: ArchiveDocument | ArchiveDocument[];
      switch (uploadMode) {
        case "folder":
          // Pass per-file relative paths so the backend can persist archival provenance
          result = await bulkUpload.mutateAsync({
            files: selectedFiles,
            sourceReferences: folderPaths.length === selectedFiles.length ? folderPaths : undefined,
          });
          break;
        case "scanner":
          result = await scannerImport.mutateAsync({ files: selectedFiles });
          break;
        case "files":
        default:
          if (selectedFiles.length === 1) {
            result = await uploadSingle.mutateAsync({ file: selectedFiles[0] });
          } else {
            result = await uploadMultiple.mutateAsync({ files: selectedFiles });
          }
          break;
      }
      const documentLabel = selectedFiles.length === 1 ? "document" : "documents";
      toast.success(`${selectedFiles.length} ${documentLabel} uploaded and queued for processing`);

      if (Array.isArray(result)) {
        setUploadedResults(result);
        setSelectedFiles([]);
        setFolderPaths([]);
      } else {
        closeDialog();
      }
    } catch (error) {
      toast.error(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getReviewBadge = (document: ArchiveDocument) => {
    const routeDecision = document.extraction?.routeDecision;
    if (document.documentType === "other_unclassified") {
      return <Badge variant="outline" className="text-xs text-orange-700 border-orange-300">Unknown type</Badge>;
    }
    if (routeDecision === "confirmation_required" || routeDecision === "unknown_waiting_for_type") {
      return <Badge variant="outline" className="text-xs text-orange-700 border-orange-300">Needs manual confirmation</Badge>;
    }
    if (isDocumentPendingReview(document)) {
      return <Badge variant="outline" className="text-xs text-orange-700 border-orange-300">Needs review</Badge>;
    }
    return <Badge variant="outline" className="text-xs text-green-700 border-green-300">Auto-routed</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">
            Upload Documents
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            {showingResults
              ? "Review the created records before closing this dialog."
              : "Add documents to the archive using any of the methods below."}
          </DialogDescription>
        </DialogHeader>

        {showingResults ? (
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm font-medium text-foreground">
                  {uploadedResults.length} document{uploadedResults.length !== 1 ? "s" : ""} created
                </p>
                <p className="font-body text-xs text-muted-foreground mt-1">
                  Each item below shows the initial workflow state after upload.
                </p>
              </div>
              <Badge variant="secondary" className="font-body">
                {uploadMode.replace(/_/g, " ")}
              </Badge>
            </div>

            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
              {uploadedResults.map((document) => (
                <div key={document.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-sm font-medium text-foreground truncate" title={document.originalFileName ?? document.title}>
                        {document.originalFileName ?? document.title}
                      </p>
                      <p className="font-body text-xs text-muted-foreground mt-1">
                        {document.documentType
                          ? getDocumentTypeLabel(document.documentType)
                          : "Type not assigned yet"}
                      </p>
                    </div>
                    <ProcessingStatusBadge status={document.processingStatus} lifecycleStatus={document.status} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {document.documentType && (
                      <Badge variant="secondary" className="text-xs font-body">
                        {getDocumentTypeLabel(document.documentType)}
                      </Badge>
                    )}
                    {document.needsReview ? (
                      <Badge variant="outline" className="text-xs text-orange-700 border-orange-300">
                        Review required
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-slate-700 border-slate-300">
                        No review flag
                      </Badge>
                    )}
                    {getReviewBadge(document)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setUploadedResults([])}
                className="font-body"
              >
                Upload more
              </Button>
              <Button
                onClick={closeDialog}
                className="font-body bg-primary hover:bg-primary/90"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
        <>

        <Tabs
          value={uploadMode}
          onValueChange={(v) => {
            setUploadMode(v as typeof uploadMode);
            setSelectedFiles([]);
            setFolderPaths([]);
          }}
          className="mt-4"
        >
          <TabsList className="w-full">
            <TabsTrigger value="files" className="flex-1 gap-2 font-body">
              <Upload className="h-4 w-4" />
              Files
            </TabsTrigger>
            <TabsTrigger value="folder" className="flex-1 gap-2 font-body">
              <FolderOpen className="h-4 w-4" />
              Folder
            </TabsTrigger>
            <TabsTrigger value="scanner" className="flex-1 gap-2 font-body">
              <ScanLine className="h-4 w-4" />
              Scanner
            </TabsTrigger>
          </TabsList>

          {/* File Upload Tab */}
          <TabsContent value="files" className="space-y-4">
            {/* Page-first intake notice */}
            {PAGE_FIRST_INTAKE_ENABLED && (
              <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-body text-primary">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                Page-first intake is enabled — uploaded PDFs will be split into individually labelled pages and you will be taken to the review screen.
              </div>
            )}
            {/* Drag and Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-body text-sm text-foreground mb-1">
                Drag & drop files here, or{" "}
                <button
                  type="button"
                  className="text-primary underline hover:text-primary/80"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse files
                </button>
              </p>
              <p className="font-body text-xs text-muted-foreground">
                Supported: PDF, images (PNG, JPEG, TIFF, BMP, WebP), plain text, CSV, HTML, Markdown
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept={SUPPORTED_ACCEPT}
              />
            </div>
          </TabsContent>

          {/* Folder Upload Tab */}
          <TabsContent value="folder" className="space-y-4">
            <div className="border-2 border-dashed rounded-xl p-8 text-center border-border hover:border-primary/50 transition-colors">
              <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-body text-sm text-foreground mb-1">
                <button
                  type="button"
                  className="text-primary underline hover:text-primary/80"
                  onClick={() => folderInputRef.current?.click()}
                >
                  Select a folder
                </button>{" "}
                to upload all files within it
              </p>
              <p className="font-body text-xs text-muted-foreground">
                Folder structure will be preserved as source references
              </p>
              <input
                ref={folderInputRef}
                type="file"
                /* @ts-expect-error webkitdirectory is a non-standard attribute */
                webkitdirectory=""
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </TabsContent>

          {/* Scanner Import Tab */}
          <TabsContent value="scanner" className="space-y-4">
            <div className="border-2 border-dashed rounded-xl p-8 text-center border-border hover:border-primary/50 transition-colors">
              <ScanLine className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-body text-sm text-foreground mb-1">
                <button
                  type="button"
                  className="text-primary underline hover:text-primary/80"
                  onClick={() => scannerInputRef.current?.click()}
                >
                  Import scanned documents
                </button>
              </p>
              <p className="font-body text-xs text-muted-foreground">
                PDFs and images from scanners will be queued for OCR processing
              </p>
              <input
                ref={scannerInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between">
              <span className="font-body text-sm font-medium text-foreground">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedFiles([]); setFolderPaths([]); }}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {selectedFiles.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md"
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span
                    className="font-body text-sm text-foreground truncate flex-1"
                    title={folderPaths[i] || file.name}
                  >
                    {/* Show full relative path for folder uploads so users can verify provenance */}
                    {uploadMode === "folder" && folderPaths[i] ? folderPaths[i] : file.name}
                  </span>
                  <Badge variant="outline" className="text-xs font-body">
                    {formatFileSize(file.size)}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Button */}
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={closeDialog}
            disabled={isUploading}
            className="font-body"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="gap-2 font-body bg-primary hover:bg-primary/90"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}
              </>
            )}
          </Button>
        </div>

        {/* Upload Status */}
        {(uploadSingle.isSuccess || uploadMultiple.isSuccess) && (
          <div className="flex items-center gap-2 text-sm text-green-600 font-body">
            <CheckCircle2 className="h-4 w-4" />
            Upload completed successfully
          </div>
        )}
        {(uploadSingle.isError || uploadMultiple.isError || bulkUpload.isError || scannerImport.isError) && (
          <div className="flex items-center gap-2 text-sm text-destructive font-body">
            <AlertCircle className="h-4 w-4" />
            Upload failed. Please try again.
          </div>
        )}
        </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;
