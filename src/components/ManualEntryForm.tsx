/**
 * Manual Entry Form Component
 *
 * Allows staff to manually create a document record with metadata.
 * An optional file can be attached at creation time; if provided, the record
 * is immediately queued for OCR/extraction after creation.
 * Files can also be attached to existing records via the document detail view.
 */

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PenLine, Loader2, Paperclip, X, FileText } from "lucide-react";
import { DOCUMENT_CATEGORIES, DOCUMENT_TYPES } from "@/types/document";
import type { DocumentCategory, DocumentType } from "@/types/document";
import { useManualEntry, useAttachFileToDocument } from "@/hooks/useDocuments";
import { toast } from "sonner";

// File types accepted when attaching to a manual record
// Must match the backend's supported extraction formats.
const ATTACH_ACCEPT = ".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp,.txt,.csv,.html,.md";

const ATTACH_LABEL_MAP: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/tiff": "TIFF",
  "image/bmp": "BMP",
  "image/webp": "WebP",
  "text/plain": "TXT",
  "text/csv": "CSV",
  "text/html": "HTML",
  "text/markdown": "Markdown",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ManualEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ManualEntryForm = ({ open, onOpenChange }: ManualEntryFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [category, setCategory] = useState<DocumentCategory>("Uncategorized");
  const [type, setType] = useState<DocumentType>("Other");
  const [tags, setTags] = useState("");
  const [department, setDepartment] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const manualEntry = useManualEntry();
  const attachFile = useAttachFileToDocument();

  const isSubmitting = manualEntry.isPending || attachFile.isPending;

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAuthor("");
    setYear(String(new Date().getFullYear()));
    setCategory("Uncategorized");
    setType("Other");
    setTags("");
    setDepartment("");
    setExtractedText("");
    setAttachedFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      // Reject unsupported formats at selection time
      const supported = ATTACH_ACCEPT.split(",").some((ext) =>
        file.name.toLowerCase().endsWith(ext.trim()),
      );
      if (!supported) {
        toast.error(
          `"${file.name}" is not a supported format. Accepted: PDF, images, plain text, CSV.`,
        );
        e.target.value = "";
        return;
      }
    }
    setAttachedFile(file);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    manualEntry.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        author: author.trim() || undefined,
        year: Number(year) || new Date().getFullYear(),
        category,
        type,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        department: department.trim() || undefined,
        extractedText: extractedText.trim() || undefined,
      },
      {
        onSuccess: (createdDoc) => {
          if (attachedFile) {
            // Attach the file — backend will re-queue for OCR/extraction
            attachFile.mutate(
              { id: createdDoc.id, file: attachedFile },
              {
                onSuccess: () => {
                  toast.success("Document record created and file queued for processing.");
                  resetForm();
                  onOpenChange(false);
                },
                onError: (err) => {
                  // Record was created — warn but don't block
                  toast.warning(
                    `Record created but file attachment failed: ${err instanceof Error ? err.message : "Unknown error"}. You can attach the file later.`,
                  );
                  resetForm();
                  onOpenChange(false);
                },
              },
            );
          } else {
            toast.success("Document record created successfully.");
            resetForm();
            onOpenChange(false);
          }
        },
        onError: (error) => {
          toast.error(
            `Failed to create record: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        },
      },
    );
  };

  const submittingLabel = () => {
    if (attachFile.isPending) return "Attaching file…";
    if (manualEntry.isPending) return "Creating…";
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Manual Document Entry
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Create a document record manually. Attaching a file is optional — records without
            files will not be queued for OCR until a file is attached.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="me-title" className="font-body font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="me-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="font-body"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="me-description" className="font-body font-medium">
              Description
            </Label>
            <Textarea
              id="me-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the document"
              className="font-body"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Author */}
            <div className="space-y-2">
              <Label htmlFor="me-author" className="font-body font-medium">
                Author
              </Label>
              <Input
                id="me-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author or creator"
                className="font-body"
              />
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label htmlFor="me-year" className="font-body font-medium">
                Year
              </Label>
              <Input
                id="me-year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2024"
                className="font-body"
                min="1900"
                max="2100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-2">
              <Label className="font-body font-medium">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                <SelectTrigger className="font-body">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label className="font-body font-medium">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
                <SelectTrigger className="font-body">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="me-tags" className="font-body font-medium">
              Tags
            </Label>
            <Input
              id="me-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated tags (e.g. housing, equity, Detroit)"
              className="font-body"
            />
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label htmlFor="me-department" className="font-body font-medium">
              Department / Program
            </Label>
            <Input
              id="me-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Housing Division, Youth Programs"
              className="font-body"
            />
          </div>

          {/* Extracted Text / Content */}
          <div className="space-y-2">
            <Label htmlFor="me-extractedText" className="font-body font-medium">
              Document Content / Text
            </Label>
            <Textarea
              id="me-extractedText"
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder="Paste or type the document content here for search indexing"
              className="font-body"
              rows={5}
            />
          </div>

          {/* File attachment */}
          <div className="space-y-2">
            <Label className="font-body font-medium">Attach file (optional)</Label>
            {attachedFile ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-body text-sm text-foreground flex-1 truncate">
                  {attachedFile.name}
                </span>
                <Badge variant="outline" className="text-xs font-body shrink-0">
                  {ATTACH_LABEL_MAP[attachedFile.type] ??
                    attachedFile.name.split(".").pop()?.toUpperCase() ??
                    "FILE"}
                </Badge>
                <Badge variant="outline" className="text-xs font-body shrink-0">
                  {formatFileSize(attachedFile.size)}
                </Badge>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Remove attached file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 font-body"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
                Choose file
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ATTACH_ACCEPT}
              onChange={handleFileSelect}
            />
            <p className="text-xs text-muted-foreground font-body">
              Accepted: PDF, images (PNG, JPEG, TIFF, BMP, WebP), plain text, CSV.
              Attaching a file queues the record for OCR and extraction immediately.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="font-body"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 font-body bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {submittingLabel() ?? "Creating…"}
                </>
              ) : (
                <>
                  <PenLine className="h-4 w-4" />
                  {attachedFile ? "Create & Queue" : "Create Record"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManualEntryForm;
