import { useMemo, useState } from "react";
import { Calendar, ExternalLink, Copy, Download, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DocumentPreview } from "@/services/apiDocuments";
import { apiGetOriginalUrl } from "@/services/apiDocuments";
import { toast } from "sonner";

interface DocumentPreviewModalProps {
  preview: DocumentPreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DocumentPreviewModal({ preview, open, onOpenChange }: DocumentPreviewModalProps) {
  const [isOpeningOriginal, setIsOpeningOriginal] = useState(false);
  const [isDownloadingOriginal, setIsDownloadingOriginal] = useState(false);

  const previewBody = useMemo(() => {
    if (!preview) return "";
    return (preview.previewMarkdown ?? preview.previewText ?? "").trim();
  }, [preview]);

  if (!preview) return null;

  const handleOpenOriginal = async () => {
    setIsOpeningOriginal(true);
    try {
      const response = await apiGetOriginalUrl(preview.id, "inline");
      window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open original file.";
      toast.error(message);
    } finally {
      setIsOpeningOriginal(false);
    }
  };

  const handleDownloadOriginal = async () => {
    setIsDownloadingOriginal(true);
    try {
      const response = await apiGetOriginalUrl(preview.id, "attachment");
      const anchor = document.createElement("a");
      anchor.href = response.url;
      if (response.filename) {
        anchor.download = response.filename;
      }
      anchor.rel = "noopener noreferrer";
      anchor.target = "_blank";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to download original file.";
      toast.error(message);
    } finally {
      setIsDownloadingOriginal(false);
    }
  };

  const handleCopyMarkdown = async () => {
    const markdown = preview.previewMarkdown ?? preview.previewText;
    if (!markdown) {
      toast.error("No preview text is available to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      toast.success("Copied preview text.");
    } catch {
      toast.error("Clipboard access failed.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {preview.title}
          </DialogTitle>
          <DialogDescription>
            Extracted text and markdown preview for this document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{preview.documentType}</Badge>
            {preview.documentDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {preview.documentDate}
              </span>
            )}
            {preview.filename && <span>{preview.filename}</span>}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-body text-foreground">{previewBody || "No extracted preview available."}</pre>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleOpenOriginal} disabled={!preview.originalAvailable || isOpeningOriginal}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {isOpeningOriginal ? "Opening..." : "Open Original"}
            </Button>
            <Button variant="outline" onClick={handleDownloadOriginal} disabled={!preview.originalAvailable || isDownloadingOriginal}>
              <Download className="h-4 w-4 mr-2" />
              {isDownloadingOriginal ? "Preparing..." : "Download Original"}
            </Button>
            <Button variant="outline" onClick={handleCopyMarkdown}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Markdown
            </Button>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
