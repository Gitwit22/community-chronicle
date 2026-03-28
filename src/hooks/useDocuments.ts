/**
 * React hooks for document operations.
 *
 * Uses TanStack React Query for cache management and state synchronization.
 * Wraps the service layer so components get reactive data.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ArchiveDocument, DocumentFilters, DocumentIntakeInput, ReviewMetadata } from "@/types/document";
import {
  apiCreateManualEntry,
  apiDeleteDocument,
  apiGetAllDocuments,
  apiGetDocumentById,
  apiGetReviewQueue,
  apiMarkForReview,
  apiResolveReview,
  apiRetryProcessing,
  apiUpdateDocument,
  apiUploadMultipleFiles,
  apiUploadSingleFile,
} from "@/services/apiDocuments";
import { detectDuplicates } from "@/services/duplicateDetectionService";

const QUERY_KEYS = {
  documents: ["documents"] as const,
  document: (id: string) => ["documents", id] as const,
  search: (filters: DocumentFilters) => ["documents", "search", filters] as const,
  years: ["documents", "years"] as const,
  tags: ["documents", "tags"] as const,
  categories: ["documents", "categories"] as const,
  statusCounts: ["documents", "statusCounts"] as const,
  reviewQueue: ["documents", "reviewQueue"] as const,
};

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

/** Hook: Upload single file */
export function useUploadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, metadata }: { file: File; metadata?: Partial<DocumentIntakeInput> }) =>
      apiUploadSingleFile(file, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Upload multiple files */
export function useUploadMultipleFiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ files, metadata }: { files: File[]; metadata?: Partial<DocumentIntakeInput> }) =>
      apiUploadMultipleFiles(files, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Drag-and-drop upload */
export function useDragDropUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ files, metadata }: { files: File[]; metadata?: Partial<DocumentIntakeInput> }) =>
      apiUploadMultipleFiles(files, { ...metadata, intakeSource: "drag_drop" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Bulk folder upload */
export function useBulkUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ files, metadata }: { files: File[]; metadata?: Partial<DocumentIntakeInput> }) =>
      apiUploadMultipleFiles(files, { ...metadata, intakeSource: "bulk_folder" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

/** Hook: Scanner import */
export function useScannerImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ files, metadata }: { files: File[]; metadata?: Partial<DocumentIntakeInput> }) =>
      apiUploadMultipleFiles(files, { ...metadata, intakeSource: "scanner_import" }),
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

/** Hook: Retry processing a failed document */
export function useRetryProcessing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRetryProcessing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

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

/** Hook: Run duplicate detection */
export function useDetectDuplicates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, file }: { docId: string; file?: File }) =>
      detectDuplicates(docId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
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
