import type {
  ArchiveDocument,
  ChronicleDocumentType,
  ChronicleTypeFingerprint,
  DocumentFilters,
  DocumentIntakeInput,
  ReviewMetadata,
} from "@/types/document";
import { API_BASE } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/tokenStorage";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as Record<string, unknown>).error)
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function buildQuery(filters: DocumentFilters): string {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.year) params.set("year", filters.year);
  if (filters.category) params.set("category", filters.category);
  if (filters.processingStatus) params.set("processingStatus", filters.processingStatus);
  if (filters.intakeSource) params.set("intakeSource", filters.intakeSource);
  // Phase 2: lightweight metadata filters
  if (filters.documentType) params.set("documentType", filters.documentType);
  if (filters.sourceName) params.set("sourceName", filters.sourceName);
  if (filters.person) params.set("person", filters.person);
  if (filters.company) params.set("company", filters.company);
  if (filters.location) params.set("location", filters.location);
  if (filters.referenceNumber) params.set("referenceNumber", filters.referenceNumber);
  if (filters.reviewRequired !== undefined) params.set("reviewRequired", String(filters.reviewRequired));
  if (filters.classificationStatus) params.set("classificationStatus", filters.classificationStatus);

  const query = params.toString();
  return query ? `?${query}` : "";
}

function appendOptionalMetadata(formData: FormData, metadata?: Partial<DocumentIntakeInput>) {
  if (!metadata) return;

  if (metadata.title) formData.set("title", metadata.title);
  if (metadata.description) formData.set("description", metadata.description);
  if (metadata.author) formData.set("author", metadata.author);
  if (metadata.year) formData.set("year", String(metadata.year));
  if (metadata.month) formData.set("month", String(metadata.month));
  if (metadata.category) formData.set("category", metadata.category);
  if (metadata.type) formData.set("type", metadata.type);
  if (metadata.financialCategory) formData.set("financialCategory", metadata.financialCategory);
  if (metadata.financialDocumentType)
    formData.set("financialDocumentType", metadata.financialDocumentType);
  if (metadata.department) formData.set("department", metadata.department);
  if (metadata.sourceReference) formData.set("sourceReference", metadata.sourceReference);
  if (metadata.intakeSource) formData.set("intakeSource", metadata.intakeSource);
  if (metadata.tags) formData.set("tags", JSON.stringify(metadata.tags));
  if (metadata.keywords) formData.set("keywords", JSON.stringify(metadata.keywords));
}

export async function apiGetAllDocuments(filters: DocumentFilters = {}): Promise<ArchiveDocument[]> {
  const response = await fetch(`${API_BASE}/documents${buildQuery(filters)}`, {
    headers: getAuthHeaders(),
  });
  return parseJsonResponse<ArchiveDocument[]>(response);
}

export async function apiGetDocumentById(id: string): Promise<ArchiveDocument | undefined> {
  const response = await fetch(`${API_BASE}/documents/${id}`, {
    headers: getAuthHeaders(),
  });
  if (response.status === 404) return undefined;
  return parseJsonResponse<ArchiveDocument>(response);
}

export async function apiUploadSingleFile(
  file: File,
  metadata?: Partial<DocumentIntakeInput>
): Promise<ArchiveDocument> {
  const formData = new FormData();
  formData.set("file", file);
  appendOptionalMetadata(formData, metadata);

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return parseJsonResponse<ArchiveDocument>(response);
}

export async function apiUploadMultipleFiles(
  files: File[],
  metadata?: Partial<DocumentIntakeInput>,
  /**
   * Per-file relative paths (same index as `files`).
   * For folder uploads, pass `file.webkitRelativePath` for each file so the
   * backend can persist per-file source provenance in `sourceReference`.
   *
   * Backend contract: read `sourceReferences` as a JSON-encoded string[] from
   * FormData. Use `sourceReferences[i]` as the `sourceReference` for `files[i]`.
   * The top-level `intakeSource` (e.g. "bulk_folder") is still taken from
   * `metadata.intakeSource`.
   */
  sourceReferences?: string[]
): Promise<ArchiveDocument[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  appendOptionalMetadata(formData, metadata);
  if (sourceReferences && sourceReferences.length > 0) {
    formData.set("sourceReferences", JSON.stringify(sourceReferences));
  }

  const response = await fetch(`${API_BASE}/documents/upload/batch`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return parseJsonResponse<ArchiveDocument[]>(response);
}

/**
 * Attach or replace the file on an existing manual-entry document.
 *
 * Backend contract: `POST /documents/:id/attach-file`
 *   - FormData field: `file` (the uploaded file)
 *   - On success: returns the updated ArchiveDocument with fileUrl populated
 *   - Side effect: backend should re-queue the document for OCR/extraction
 *     (equivalent to calling /retry afterwards), so callers do NOT need to
 *     call apiRetryProcessing separately when a file is newly attached.
 *   - If the document already had a file (replacing), the old file should be
 *     deleted from storage before the new one is saved.
 */
export async function apiAttachFileToDocument(
  id: string,
  file: File,
): Promise<ArchiveDocument> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(`${API_BASE}/documents/${id}/attach-file`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  return parseJsonResponse<ArchiveDocument>(response);
}

export async function apiCreateManualEntry(
  input: Omit<DocumentIntakeInput, "intakeSource">
): Promise<ArchiveDocument> {
  const response = await fetch(`${API_BASE}/documents/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(input),
  });

  return parseJsonResponse<ArchiveDocument>(response);
}

export async function apiUpdateDocument(
  id: string,
  updates: Partial<ArchiveDocument>
): Promise<ArchiveDocument> {
  const response = await fetch(`${API_BASE}/documents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });

  return parseJsonResponse<ArchiveDocument>(response);
}

/**
 * Delete a document record and its associated stored file.
 *
 * Backend contract: `DELETE /documents/:id`
 *   - Must delete the DB record AND the stored file:
 *     - R2-backed: delete the object from the R2 bucket using the S3 client
 *     - Local/network-backed: delete the file from disk
 *   - Response body (optional but preferred):
 *     `{ deleted: true, storageDeleted: boolean, fileUrl?: string }`
 *   - If storage deletion fails, still return 200 with `storageDeleted: false`
 *     so the frontend can surface a warning about orphaned blobs.
 *   - Returns 404 if document not found; do NOT 500 on storage-only errors.
 *
 * Migration/backfill note: existing documents created before this change may
 * have fileUrl values that are relative paths (local) or full R2 URLs. The
 * backend should normalise the key by stripping the R2 public URL prefix when
 * calling `DeleteObjectCommand`.
 */
export async function apiDeleteDocument(id: string): Promise<{ deleted: boolean; storageDeleted?: boolean }> {
  const response = await fetch(`${API_BASE}/documents/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (response.status === 404) return { deleted: false };
  if (response.status === 204) return { deleted: true, storageDeleted: true };

  try {
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const msg = typeof body.error === "string" ? body.error : `Delete failed: ${response.status}`;
      throw new Error(msg);
    }
    return {
      deleted: body.deleted !== false,
      storageDeleted: typeof body.storageDeleted === "boolean" ? body.storageDeleted : undefined,
    };
  } catch (e) {
    if (!response.ok) throw e;
    return { deleted: true, storageDeleted: undefined };
  }
}

export async function apiRetryProcessing(id: string): Promise<ArchiveDocument> {
  const response = await fetch(`${API_BASE}/documents/${id}/retry`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  return parseJsonResponse<ArchiveDocument>(response);
}

export async function apiBulkReprocess(ids?: string[]): Promise<{ queued: number; documentIds: string[] }> {
  const response = await fetch(`${API_BASE}/documents/reprocess`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(ids ? { ids } : {}),
  });

  return parseJsonResponse<{ queued: number; documentIds: string[] }>(response);
}

export async function apiGetReviewQueue(): Promise<ArchiveDocument[]> {
  const response = await fetch(`${API_BASE}/review-queue`, {
    headers: getAuthHeaders(),
  });
  return parseJsonResponse<ArchiveDocument[]>(response);
}

export async function apiResolveReview(
  docId: string,
  resolution: ReviewMetadata["resolution"],
  notes?: string
): Promise<ArchiveDocument> {
  const response = await fetch(`${API_BASE}/review-queue/${docId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ resolution, notes }),
  });

  return parseJsonResponse<ArchiveDocument>(response);
}

export async function apiMarkForReview(
  docId: string,
  reasons: string[],
  priority: ReviewMetadata["priority"] = "medium"
): Promise<ArchiveDocument> {
  const response = await fetch(`${API_BASE}/review-queue/${docId}/mark`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ reasons, priority }),
  });

  return parseJsonResponse<ArchiveDocument>(response);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Document type registry
// ─────────────────────────────────────────────────────────────────────────────

/** Get all document types (system + custom) */
export async function apiGetDocumentTypes(): Promise<ChronicleDocumentType[]> {
  const response = await fetch(`${API_BASE}/document-types`, {
    headers: getAuthHeaders(),
  });
  return parseJsonResponse<ChronicleDocumentType[]>(response);
}

/** Create a new custom document type */
export async function apiCreateDocumentType(input: {
  key: string;
  label: string;
  description?: string;
}): Promise<ChronicleDocumentType> {
  const response = await fetch(`${API_BASE}/document-types`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  return parseJsonResponse<ChronicleDocumentType>(response);
}

/** Update a document type */
export async function apiUpdateDocumentType(
  id: string,
  updates: Partial<Pick<ChronicleDocumentType, "label" | "description" | "active">>,
): Promise<ChronicleDocumentType> {
  const response = await fetch(`${API_BASE}/document-types/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  return parseJsonResponse<ChronicleDocumentType>(response);
}

/** Save / update type fingerprint (learned classification patterns) */
export async function apiSaveTypeFingerprint(
  typeId: string,
  fingerprint: Partial<Pick<ChronicleTypeFingerprint, "phrases" | "companies" | "filenamePatterns" | "sampleDocumentIds">>,
): Promise<ChronicleTypeFingerprint> {
  const response = await fetch(`${API_BASE}/document-types/${typeId}/fingerprint`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(fingerprint),
  });
  return parseJsonResponse<ChronicleTypeFingerprint>(response);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Enhanced review — reclassify / type assignment
// ─────────────────────────────────────────────────────────────────────────────

export async function apiReclassifyDocument(
  docId: string,
  payload: {
    documentType: string;
    notes?: string;
    saveAsFingerprint?: boolean;
    createNewType?: boolean;
    newTypeLabel?: string;
  },
): Promise<ArchiveDocument> {
  const response = await fetch(`${API_BASE}/review-queue/${docId}/reclassify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<ArchiveDocument>(response);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Metadata search
// ─────────────────────────────────────────────────────────────────────────────

export interface MetaSearchFilters {
  person?: string;
  company?: string;
  location?: string;
  referenceNumber?: string;
  sourceName?: string;
  documentType?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}

export async function apiSearchByMetadata(filters: MetaSearchFilters): Promise<{
  documents: ArchiveDocument[];
  total: number;
  limit: number;
  offset: number;
}> {
  const params = new URLSearchParams();
  if (filters.person) params.set("person", filters.person);
  if (filters.company) params.set("company", filters.company);
  if (filters.location) params.set("location", filters.location);
  if (filters.referenceNumber) params.set("referenceNumber", filters.referenceNumber);
  if (filters.sourceName) params.set("sourceName", filters.sourceName);
  if (filters.documentType) params.set("documentType", filters.documentType);
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.offset) params.set("offset", String(filters.offset));

  const response = await fetch(`${API_BASE}/documents/search-meta?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return parseJsonResponse(response);
}
