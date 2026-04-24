/**
 * React hooks for document operations.
 *
 * Uses TanStack React Query for cache management and state synchronization.
 * Wraps the service layer so components get reactive data.
 *
 * Phase 2 (search-first model):
 * - Upload hooks no longer run browser-side Llama/LLM schema extraction before
 *   the file hits the server. Files are uploaded directly; the server pipeline
 *   handles text extraction and lightweight metadata classification.
 * - Browser-side classification (documentTypeClassifier) is available for
 *   instant UI feedback but does NOT block the upload.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ArchiveDocument,
  ChronicleDocumentType,
  DocumentFilters,
  DocumentIntakeInput,
  ReviewMetadata,
} from "@/types/document";
import {
  apiAttachFileToDocument,
  apiCreateManualEntry,
  apiBulkReprocess,
  apiDeleteDocument,
  apiGetAllDocuments,
  apiGetDocumentById,
  apiGetReviewQueue,
  apiMarkForReview,
  apiReclassifyDocument,
  apiResolveReview,
  apiRetryProcessing,
  apiUpdateDocument,
  apiUploadMultipleFiles,
  apiUploadSingleFile,
  apiGetDocumentTypes,
  apiCreateDocumentType,
  apiUpdateDocumentType,
  apiSaveTypeFingerprint,
} from "@/services/apiDocuments";

const QUERY_KEYS = {
  documents: ["documents"] as const,
  document: (id: string) => ["documents", id] as const,
  search: (filters: DocumentFilters) => ["documents", "search", filters] as const,
  years: ["documents", "years"] as const,
  tags: ["documents", "tags"] as const,
  categories: ["documents", "categories"] as const,
  documentTypes: ["document-types"] as const,
  statusCounts: ["documents", "statusCounts"] as const,
  reviewQueue: ["documents", "reviewQueue"] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Query hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Hook: Get all documents */
export function useDocuments() {
  return useQuery({
    queryKey: QUERY_KEYS.documents,
    queryFn: () => apiGetAllDocuments(),
    staleTime: 1000,
  });
}

/** Hook: Get a single document by ID */
export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.document(id || ""),
    queryFn: () => (id ? apiGetDocumentById(id) : undefined),
    enabled: !!id,
  });
}

/** Hook: Search and filter documents */
export function useDocumentSearch(filters: DocumentFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.search(filters),
    queryFn: () => apiGetAllDocuments(filters),
    staleTime: 500,
  });
}

/** Hook: Get unique years */
export function useDocumentYears() {
  return useQuery({
    queryKey: QUERY_KEYS.years,
    queryFn: async () => {
      const docs = await apiGetAllDocuments();
      return [...new Set(docs.map((d) => d.year))].sort((a, b) => b - a);
    },
  });
}

/** Hook: Get all tags */
export function useDocumentTags() {
  return useQuery({
    queryKey: QUERY_KEYS.tags,
    queryFn: async () => {
      const docs = await apiGetAllDocuments();
      const tagSet = new Set<string>();
      docs.forEach((doc) => doc.tags.forEach((tag) => tagSet.add(tag)));
      return [...tagSet].sort();
    },
  });
}

/** Hook: Get used categories */
export function useDocumentCategories() {
  return useQuery({
    queryKey: QUERY_KEYS.categories,
    queryFn: async () => {
      const docs = await apiGetAllDocuments();
      return [...new Set(docs.map((d) => d.category))].sort();
    },
  });
}

/** Hook: Get status counts for dashboard */
export function useStatusCounts() {
  return useQuery({
    queryKey: QUERY_KEYS.statusCounts,
    queryFn: async () => {
      const docs = await apiGetAllDocuments();
      const counts: Record<string, number> = {};
      docs.forEach((doc) => {
        counts[doc.processingStatus] = (counts[doc.processingStatus] || 0) + 1;
      });
      return counts;
    },
  });
}

/** Hook: Get the review queue */
export function useReviewQueue() {
  return useQuery({
    queryKey: QUERY_KEYS.reviewQueue,
    queryFn: apiGetReviewQueue,
    staleTime: 1000,
  });
}

/** Hook: Get document type registry (system + custom types) */
export function useDocumentTypes() {
  return useQuery({
    queryKey: QUERY_KEYS.documentTypes,
    queryFn: apiGetDocumentTypes,
    staleTime: 60_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload / intake mutation hooks
// All upload paths now go directly to the server without browser-side
// heavy extraction.  The server pipeline handles OCR → metadata → classify.
// ─────────────────────────────────────────────────────────────────────────────

/** Hook: Upload single file */
export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, metadata }: { file: File; metadata?: Partial<DocumentIntakeInput> }) => {
      return apiUploadSingleFile(file, metadata);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Upload multiple files */
export function useUploadMultipleFiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ files, metadata }: { files: File[]; metadata?: Partial<DocumentIntakeInput> }) => {
      return apiUploadMultipleFiles(files, metadata);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Drag-and-drop upload */
export function useDragDropUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ files, metadata }: { files: File[]; metadata?: Partial<DocumentIntakeInput> }) => {
      return apiUploadMultipleFiles(files, { ...metadata, intakeSource: "drag_drop" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Bulk folder upload */
export function useBulkUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      files,
      metadata,
      sourceReferences,
    }: {
      files: File[];
      metadata?: Partial<DocumentIntakeInput>;
      sourceReferences?: string[];
    }) => {
      return apiUploadMultipleFiles(
        files,
        { ...metadata, intakeSource: "bulk_folder" },
        sourceReferences,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Scanner import */
export function useScannerImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ files, metadata }: { files: File[]; metadata?: Partial<DocumentIntakeInput> }) => {
      return apiUploadMultipleFiles(files, { ...metadata, intakeSource: "scanner_import" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Manual document entry */
export function useManualEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<DocumentIntakeInput, "intakeSource">) =>
      apiCreateManualEntry(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Document mutation hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Hook: Attach or replace the file on an existing document. */
export function useAttachFileToDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      apiAttachFileToDocument(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents", "reviewQueue"] });
    },
  });
}

/** Hook: Update a document */
export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ArchiveDocument> }) =>
      apiUpdateDocument(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Delete a document */
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiDeleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Delete multiple documents */
export function useBulkDeleteDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => apiDeleteDocument(id)));
      const deletedCount = results.filter(
        (r) => r.status === "fulfilled" && r.value.deleted,
      ).length;
      const notFoundCount = results.filter(
        (r) => r.status === "fulfilled" && !r.value.deleted,
      ).length;
      const failedCount = results.filter((r) => r.status === "rejected").length;
      const orphanedStorageCount = results.filter(
        (r) => r.status === "fulfilled" && r.value.deleted && r.value.storageDeleted === false,
      ).length;
      return { total: ids.length, deletedCount, notFoundCount, failedCount, orphanedStorageCount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Retry processing a single failed document */
export function useRetryProcessing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRetryProcessing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Re-queue multiple documents (or all eligible) for OCR/extraction */
export function useBulkReprocess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => apiBulkReprocess(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Review queue hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Hook: Resolve a review decision */
export function useResolveReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      docId,
      resolution,
      notes,
    }: {
      docId: string;
      resolution: ReviewMetadata["resolution"];
      notes?: string;
    }) => apiResolveReview(docId, resolution, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Reclassify a document — assign a new type, optionally create a custom type */
export function useReclassifyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      docId,
      type,
      notes,
      saveAsFingerprint,
      createNewType,
      newTypeLabel,
    }: {
      docId: string;
      type: string;
      notes?: string;
      saveAsFingerprint?: boolean;
      createNewType?: boolean;
      newTypeLabel?: string;
    }) => apiReclassifyDocument(docId, { type, notes, saveAsFingerprint, createNewType, newTypeLabel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["document-types"] });
    },
  });
}

/** Hook: Mark document for human review */
export function useMarkForReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      docId,
      reasons,
      priority,
    }: {
      docId: string;
      reasons: string[];
      priority?: ReviewMetadata["priority"];
    }) => apiMarkForReview(docId, reasons, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Document type registry hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Hook: Create a custom document type */
export function useCreateDocumentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; label: string; description?: string }) =>
      apiCreateDocumentType(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-types"] });
    },
  });
}

/** Hook: Update a document type (label, description, active) */
export function useUpdateDocumentType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ChronicleDocumentType> }) =>
      apiUpdateDocumentType(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-types"] });
    },
  });
}

/** Hook: Save/update type fingerprint (learned patterns) */
export function useSaveTypeFingerprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      typeId,
      fingerprint,
    }: {
      typeId: string;
      fingerprint: {
        phrases?: string[];
        companies?: string[];
        filenamePatterns?: string[];
        sampleDocumentIds?: string[];
      };
    }) => apiSaveTypeFingerprint(typeId, fingerprint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-types"] });
    },
  });
}
