/**
 * React hooks for document operations.
 *
 * Uses TanStack React Query for cache management and state synchronization.
 * Wraps the service layer so components get reactive data.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ArchiveDocument, DocumentDisplayStatus, DocumentFilters, DocumentIntakeInput, ReviewMetadata } from "@/types/document";
import { getDocumentDisplayStatus } from "@/types/document";
import {
  apiAttachFileToDocument,
  apiCreateManualEntry,
  apiBulkReprocess,
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
import { processDocument } from "@/services/coreApiClient";

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

function mapDocIntelTypeToCategory(docType?: string): ArchiveDocument["category"] | undefined {
  if (!docType) return undefined;

  const normalized = docType.toLowerCase();
  if (normalized.includes("invoice") || normalized.includes("receipt") || normalized.includes("bank")) {
    return "Financial Documents";
  }
  if (normalized.includes("grant") || normalized.includes("application") || normalized.includes("form")) {
    return "Applications/Forms";
  }
  if (normalized.includes("contract") || normalized.includes("legal")) {
    return "Legal Documents";
  }
  if (normalized.includes("minutes") || normalized.includes("board")) {
    return "Meeting Minutes";
  }
  if (normalized.includes("newsletter")) {
    return "Outreach Materials";
  }
  if (normalized.includes("report")) {
    return "Reports";
  }
  if (normalized.includes("irs") || normalized.includes("tax")) {
    return "Financial Documents";
  }
  return "Uncategorized";
}

async function runDirectDocIntelForFiles(files: File[]): Promise<{ inferredCategory?: ArchiveDocument["category"]; failures: number }> {
  const jobs = await Promise.allSettled(
    files.map((file) => processDocument(file, { parse: true, classify: true })),
  );

  const inferred = jobs
    .filter((job): job is PromiseFulfilledResult<{ classify?: { documentType?: string } }> => job.status === "fulfilled")
    .map((job) => mapDocIntelTypeToCategory(job.value.classify?.documentType))
    .filter((category): category is ArchiveDocument["category"] => Boolean(category));

  const unique = [...new Set(inferred)];
  const inferredCategory = unique.length === 1 ? unique[0] : undefined;
  const failures = jobs.filter((job) => job.status === "rejected").length;

  if (failures > 0) {
    console.warn("Direct Core API processing failed for some files before upload", {
      total: files.length,
      failures,
    });
  }

  return { inferredCategory, failures };
}


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
    mutationFn: async ({ file, metadata }: { file: File; metadata?: Partial<DocumentIntakeInput> }) => {
      const intel = await processDocument(file, { parse: true, classify: true });
      const inferredCategory = mapDocIntelTypeToCategory(intel.classify?.documentType);

      return apiUploadSingleFile(file, {
        ...metadata,
        category: metadata?.category ?? inferredCategory,
      });
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
      const intel = await runDirectDocIntelForFiles(files);
      return apiUploadMultipleFiles(files, {
        ...metadata,
        category: metadata?.category ?? intel.inferredCategory,
      });
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
      const intel = await runDirectDocIntelForFiles(files);
      return apiUploadMultipleFiles(files, {
        ...metadata,
        intakeSource: "drag_drop",
        category: metadata?.category ?? intel.inferredCategory,
      });
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
      const intel = await runDirectDocIntelForFiles(files);
      return apiUploadMultipleFiles(
        files,
        {
          ...metadata,
          intakeSource: "bulk_folder",
          category: metadata?.category ?? intel.inferredCategory,
        },
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
      const intel = await runDirectDocIntelForFiles(files);
      return apiUploadMultipleFiles(files, {
        ...metadata,
        intakeSource: "scanner_import",
        category: metadata?.category ?? intel.inferredCategory,
      });
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

/**
 * Hook: Attach or replace the file on an existing document.
 */
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
