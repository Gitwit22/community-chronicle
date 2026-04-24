import type { ArchiveDocument } from "@/types/document";

export function isDocumentUnclassified(document: ArchiveDocument): boolean {
  return (
    document.documentType === "other_unclassified" ||
    document.classificationStatus === "other_unclassified"
  );
}

export function isDocumentPendingReview(document: ArchiveDocument): boolean {
  return (
    isDocumentUnclassified(document) ||
    (document.review?.required === true && !document.review?.resolution) ||
    document.needsReview === true ||
    document.processingStatus === "needs_review" ||
    document.status === "review_required"
  );
}
