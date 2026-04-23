/**
 * Enhanced document types for the Community Chronicle archive system.
 *
 * These types support the full document lifecycle:
 * intake → processing → categorization → storage → retrieval
 */

/** Processing status of a document in the pipeline */
export type ProcessingStatus =
  | "uploaded"
  | "imported"
  | "queued"
  | "processing"
  /** Lightweight filename-based intake ran; full extraction is in progress */
  | "intake_complete"
  | "processed"
  | "failed"
  | "needs_review";

/** Formal document lifecycle status for workflow tracking */
export type DocumentLifecycleStatus =
  | "intake_received"
  | "queued"
  | "extracting"
  | "extracted"
  | "categorized"
  | "review_required"
  | "archived"
  | "failed";

/** Result from a text extraction adapter */
export interface ExtractedContent {
  text: string;
  pages?: number;
  confidence?: number;
  language?: string;
  warnings?: string[];
}

/** Interface for pluggable text extraction adapters */
export interface TextExtractorAdapter {
  canHandle(file: File): boolean;
  extract(file: File): Promise<ExtractedContent>;
}

/** How the document was brought into the system */
export type IntakeSource =
  | "file_upload"
  | "multi_upload"
  | "drag_drop"
  | "bulk_folder"
  | "scanner_import"
  | "email_import"
  | "cloud_import"
  | "manual_entry"
  | "legacy_import";

/** Document categories for classification */
export const DOCUMENT_CATEGORIES = [
  "Meeting Minutes",
  "Financial Documents",
  "Applications/Forms",
  "Legal Documents",
  "Reports",
  "Correspondence",
  "Outreach Materials",
  "Policies/Procedures",
  "Historical Records",
  "Research",
  "Policy",
  "Community Report",
  "Youth Initiative",
  "Housing",
  "Education",
  "Uncategorized",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Document type/format classification */
export const DOCUMENT_TYPES = [
  "Report",
  "Brief",
  "Study",
  "Newsletter",
  "Testimony",
  "Presentation",
  "Letter",
  "Memo",
  "Form",
  "Minutes",
  "Spreadsheet",
  "Image",
  "Other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Top-level financial categories */
export const FINANCIAL_CATEGORIES = [
  "Funding",
  "Spending",
] as const;

export type FinancialCategory = (typeof FINANCIAL_CATEGORIES)[number];

/** Financial document types */
export const FINANCIAL_DOCUMENT_TYPES = [
  "Grant",
  "Donation",
  "Invoice",
  "Receipt",
  "Budget",
  "Expense Report",
  "Bank Statement",
  "Payroll",
  "Tax Document",
  "Reimbursement",
  "Purchase Order",
  "Financial Summary",
  "Audit",
  "Other",
] as const;

export type FinancialDocumentType = (typeof FINANCIAL_DOCUMENT_TYPES)[number];

/** Month names for display */
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Abbreviated month names for compact display */
export const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Result from filename/path parsing */
export interface FilenameParsedMetadata {
  year?: number;
  month?: number;
  monthName?: string;
  financialCategory?: FinancialCategory;
  financialDocumentType?: FinancialDocumentType;
  tags: string[];
  confidence: number;
  source: "folder_path" | "filename" | "content" | "manual";
}

/** OCR processing status */
export type OcrStatus = "not_needed" | "pending" | "in_progress" | "completed" | "failed";

/** A single entry in the processing audit trail */
export interface ProcessingEvent {
  timestamp: string;
  action: string;
  status: ProcessingStatus;
  details?: string;
}

/** Extracted metadata from document content */
export interface ExtractedMetadata {
  detectedTitle?: string;
  detectedDate?: string;
  detectedAuthor?: string;
  detectedOrganization?: string;
  pageCount?: number;
  wordCount?: number;
  language?: string;
}

/** Llama Cloud classification result (sub-object within ClassificationResult) */
export interface LlamaCloudClassification {
  provider: "llama-cloud";
  status: "complete" | "failed" | "skipped";
  documentType: string;
  confidence: number | null;
  reasoning: string | null;
  jobId: string | null;
  decision: "auto_accepted" | "needs_review" | "low_confidence" | null;
  classifiedAt: string;
}

/** Core API classification result (provider-agnostic shape from backend) */
export interface CoreApiClassification {
  provider: "core-api";
  status: "complete" | "failed" | "skipped";
  documentType: string;
  confidence: number | null;
  reasoning: string | null;
  jobId: string | null;
  decision: "auto_accepted" | "needs_review" | "low_confidence" | null;
  classifiedAt: string;
}

export type ExtractionDocumentType =
  | "voucher_cover"
  | "vendor_invoice"
  | "deposit_summary"
  | "check_image"
  | "donor_acknowledgment_letter"
  | "donation_reply_card"
  | "bank_statement_or_reconciliation"
  | "payment_confirmation"
  | "unknown_document";

/** AI/rule-based classification result */
export interface ClassificationResult {
  category: DocumentCategory;
  confidence: number;
  method: "rule_based" | "ai_assisted" | "manual";
  provider?: "core-api" | "llama-cloud" | "rule-based";
  decision?: "auto_accepted" | "needs_review" | "low_confidence" | null;
  documentType?: string;
  reasoning?: string | null;
  suggestedTags: string[];
  financialCategory?: FinancialCategory;
  financialDocumentType?: FinancialDocumentType;
  /** Llama Cloud classification sub-result, present when AI classification ran */
  llamaCloud?: LlamaCloudClassification;
  /** Core API classification sub-result, present in new processing path */
  coreApi?: CoreApiClassification;
}

/**
 * The master document record.
 * This is the core data structure for every document in the archive.
 */
export interface ArchiveDocument {
  /** Unique document ID (UUID) */
  id: string;
  /** Document title (user-provided or detected) */
  title: string;
  /** Full description */
  description: string;
  /** Author or creator */
  author: string;
  /** Year of the document (for timeline/filtering) */
  year: number;
  /** Month of the document (1-12, for filtering) */
  month?: number;

  // --- Classification ---
  /** Primary category */
  category: DocumentCategory;
  /** Document type/format */
  type: DocumentType;
  /** Financial category (Funding or Spending) */
  financialCategory?: FinancialCategory;
  /** Financial document type (Grant, Invoice, etc.) */
  financialDocumentType?: FinancialDocumentType;
  /** User-assigned or auto-generated tags */
  tags: string[];
  /** Search keywords */
  keywords: string[];

  // --- File Information ---
  /** Original file name as uploaded */
  originalFileName?: string;
  /** MIME type of the original file */
  mimeType?: string;
  /** File size in bytes */
  fileSize?: number;
  /** Storage reference/path for the original file */
  fileUrl: string;
  /** Reference to the File object in browser memory (transient, not persisted) */
  fileRef?: File;

  // --- Processing ---
  /** Current processing status */
  processingStatus: ProcessingStatus;
  /** OCR status for scanned/image documents */
  ocrStatus: OcrStatus;
  /** Extracted text content (for search and query) */
  extractedText: string;
  /** Extracted metadata from document analysis */
  extractedMetadata: ExtractedMetadata;
  /** Classification result from categorization engine */
  classificationResult?: ClassificationResult;

  // --- Intake ---
  /** How this document entered the system */
  intakeSource: IntakeSource;
  /** Original source reference (email ID, cloud path, etc.) */
  sourceReference?: string;
  /** Department or program grouping */
  department?: string;

  // --- Audit ---
  /** ISO 8601 timestamp of when the record was created */
  createdAt: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
  /** Upload/import date */
  importedAt: string;
  /** Processing history / audit trail */
  processingHistory: ProcessingEvent[];

  // --- Lifecycle ---
  /** Formal lifecycle status for workflow tracking */
  status?: DocumentLifecycleStatus;
  /** Timestamp of last lifecycle status change */
  statusUpdatedAt?: string;
  /** Audit trail of lifecycle transitions */
  auditTrail?: AuditTrailEvent[];

  // --- Extraction ---
  /** Extraction metadata */
  extraction?: ExtractionMetadata;

  // --- Duplicate Detection ---
  /** Duplicate check metadata */
  duplicateCheck?: DuplicateCheckMetadata;

  // --- Review Queue ---
  /** Human review metadata */
  review?: ReviewMetadata;

  // --- Search Index ---
  /** Pre-computed search index fields */
  searchIndex?: SearchIndexFields;

  // --- Flags ---
  /** Whether manual review is needed */
  needsReview: boolean;
  /** AI-generated summary */
  aiSummary: string;

  // --- Phase 2: Lightweight search-first metadata ---
  /** Canonical document type key (from registry) */
  documentType?: string | null;
  /** Who issued / sent the document */
  sourceName?: string | null;
  /** Date extracted from document content */
  documentDate?: string | null;
  /** Person names extracted from document */
  metaPeople?: string[];
  /** Company / organisation names extracted */
  metaCompanies?: string[];
  /** Location strings extracted */
  metaLocations?: string[];
  /** Reference numbers (invoice #, grant #, etc.) */
  metaReferenceNumbers?: string[];
  /** Catch-all notable items (amounts, emails, flags) */
  metaOther?: string[];
  /** Classification status */
  classificationStatus?: DocumentClassificationStatus | null;
  /** How classification was determined */
  classificationMatchedBy?: ClassificationMatchedBy | null;
  /** Classification confidence score (0–1) */
  classificationConfidence?: number | null;
  /** True when document type is other_unclassified or confidence is low */
  reviewRequired?: boolean;
}

/** A single audit trail event */
export interface AuditTrailEvent {
  type: string;
  timestamp: string;
  actor: string;
  details: string;
}

/** Extraction metadata tracking */
export interface ExtractionMetadata {
  status: "not_started" | "processing" | "complete" | "failed";
  method?: "text" | "pdf" | "ocr" | "manual" | "fallback" | "llama_cloud" | "core_api" | "pdf_scanned" | "unsupported";
  confidence?: number;
  extractedAt?: string;
  warningMessages?: string[];
  errorMessage?: string;
  pageCount?: number;
  /** Quality tier of the extraction attempt */
  extractionQuality?: "full_extraction" | "partial_extraction" | "minimal_extraction" | "unsupported_format" | "no_extraction";
  /** Number of words extracted */
  contentLength?: number;
  /** Routed extraction document type */
  documentType?: ExtractionDocumentType | string;
  /** Classifier confidence used to select document type */
  classificationConfidence?: number;
  /** Schema ID/name used for extraction */
  schemaUsed?: string;
  /** Flattened extracted payload for review/edit */
  extractedData?: Record<string, string>;
  /** Raw extraction API response payload */
  rawExtractionResponse?: unknown;
  /** Raw parsed text retained for debugging */
  rawParsedText?: string;
  /** Raw parse API response payload */
  rawParseResponse?: unknown;
  /** True when unknown/fallback path was used */
  fallbackPathUsed?: boolean;
  /** Lightweight prediction snapshot saved before deep extraction */
  typePrediction?: DocumentTypePrediction;
  /** Manual override applied at rerun time */
  rerunManualOverride?: string | null;
  /** Final forced document type for queued rerun */
  forcedDocumentType?: string | null;
  /** Routing decision: how the system decided to handle this document after intake */
  routeDecision?: "auto_extract" | "confirmation_required" | "generic_fallback" | "manual_override" | "unknown_waiting_for_type" | null;
  /** ISO timestamp of when the intake step completed */
  intakeTimestamp?: string;
}

export interface DocumentTypePredictionCandidate {
  type: string;
  label: string;
  confidence: number;
  reasons: string[];
}

export interface DocumentTypePrediction {
  predictedType: string;
  confidence: number;
  confidenceBand: "high" | "medium" | "low";
  sourceName: string | null;
  pageCount: number;
  firstPageSnippet: string;
  candidates: DocumentTypePredictionCandidate[];
  layoutHints: string[];
}

/** Duplicate detection metadata */
export interface DuplicateCheckMetadata {
  hash?: string;
  filenameFingerprint?: string;
  possibleDuplicateIds?: string[];
  duplicateStatus?: "unique" | "possible_duplicate" | "confirmed_duplicate";
  checkedAt?: string;
}

/** Human review metadata */
export interface ReviewMetadata {
  required: boolean;
  reason?: string[];
  priority?: "low" | "medium" | "high";
  assignedTo?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  resolution?: "approved" | "corrected" | "reprocessed" | "duplicate" | "rejected";
  notes?: string;
}

/** Pre-computed search index fields */
export interface SearchIndexFields {
  titleText: string;
  bodyText: string;
  tags: string[];
  category: string;
  sourceType: string;
  status: string;
  dateTokens: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2: Lightweight search-first metadata model
// ─────────────────────────────────────────────────────────────────────────────

/** System document types — the canonical classification set */
export const SYSTEM_DOC_TYPES = [
  "invoice",
  "receipt",
  "letter",
  "form",
  "sign_in_sheet",
  "business_card",
  "report",
  "notice",
  "other_unclassified",
] as const;

export type SystemDocType = typeof SYSTEM_DOC_TYPES[number];

export const SYSTEM_DOC_TYPE_LABELS: Record<SystemDocType, string> = {
  invoice:             "Invoice",
  receipt:             "Receipt / Acknowledgment",
  letter:              "Letter / Correspondence",
  form:                "Form / Application",
  sign_in_sheet:       "Sign-In Sheet / Roster",
  business_card:       "Business Card",
  report:              "Report / Study",
  notice:              "Notice / Government Document",
  other_unclassified:  "Other (Unclassified)",
};

/**
 * Status of the auto-classification attempt.
 *   known               — matched a system or custom type with sufficient confidence
 *   other_unclassified  — no confident match; needs admin review
 *   reviewed_mapped     — admin has manually assigned a type
 *   promoted_custom_type — admin reviewed + created a new custom type from this doc
 */
export type DocumentClassificationStatus =
  | "known"
  | "other_unclassified"
  | "reviewed_mapped"
  | "promoted_custom_type";

/** How the classification was determined */
export type ClassificationMatchedBy =
  | "rule"
  | "keyword"
  | "source"
  | "fingerprint"
  | "manual";

/**
 * Lightweight searchable metadata extracted from every document.
 * Replaces the heavy schema-based extraction for the default intake flow.
 */
export interface LightweightDocumentMetadata {
  /** Canonical document type key (system or custom) */
  documentType: string | null;
  /** Who issued / sent the document */
  sourceName: string | null;
  /** Date extracted from the document (ISO string or human-readable) */
  documentDate: string | null;
  /** Person names found in the document */
  people: string[];
  /** Company / organisation names found in the document */
  companies: string[];
  /** Location strings (city, state, address) */
  locations: string[];
  /** Invoice numbers, grant IDs, case numbers, etc. */
  referenceNumbers: string[];
  /** Anything notable that doesn't fit the above buckets */
  other: string[];
  /** Per-field extraction confidence */
  confidence?: {
    documentType?: number;
    sourceName?: number;
    documentDate?: number;
  };
}

/**
 * Extracted entity — flattened representation useful for search chips.
 */
export interface ExtractedEntity {
  type: "person" | "company" | "date" | "document_type" | "source" | "title" | "reference_number" | "location" | "other";
  value: string;
  confidence?: number;
}

/** A document type in the registry (system or admin-created custom) */
export interface ChronicleDocumentType {
  id: string;
  organizationId: string;
  programDomain: string;
  key: string;
  label: string;
  description: string;
  isSystemType: boolean;
  isUserCreated: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  fingerprint?: ChronicleTypeFingerprint | null;
}

/** Learned classification patterns for a document type */
export interface ChronicleTypeFingerprint {
  id: string;
  documentTypeId: string;
  phrases: string[];
  companies: string[];
  filenamePatterns: string[];
  datePatterns: string[];
  sampleDocumentIds: string[];
  updatedAt: string;
}

/**
 * Input for creating a new document through any intake method.
 * Only requires minimal fields; the pipeline fills in the rest.
 */
export interface DocumentIntakeInput {
  title?: string;
  description?: string;
  author?: string;
  year?: number;
  month?: number;
  category?: DocumentCategory;
  type?: DocumentType;
  financialCategory?: FinancialCategory;
  financialDocumentType?: FinancialDocumentType;
  tags?: string[];
  keywords?: string[];
  department?: string;
  intakeSource: IntakeSource;
  sourceReference?: string;
  file?: File;
  extractedText?: string;
}

/** Filters for document search and retrieval */
export interface DocumentFilters {
  search?: string;
  year?: string;
  month?: string;
  category?: string;
  type?: string;
  financialCategory?: string;
  financialDocumentType?: string;
  intakeSource?: string;
  processingStatus?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  // Phase 2: lightweight metadata filters
  /** Filter by canonical document type key (invoice, receipt, etc.) */
  documentType?: string;
  /** Filter by source/issuer name (partial match) */
  sourceName?: string;
  /** Filter by person name found in document (partial match) */
  person?: string;
  /** Filter by company name found in document (partial match) */
  company?: string;
  /** Filter by location string (partial match) */
  location?: string;
  /** Filter by reference number (partial match) */
  referenceNumber?: string;
  /** Filter: show only documents requiring review */
  reviewRequired?: boolean;
  /** Filter by classification status */
  classificationStatus?: DocumentClassificationStatus;
}

/** Paginated result set */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Unified display status
//
// Both processingStatus and lifecycle status (doc.status) carry meaningful
// state, but they use overlapping vocabulary which causes confusion in filters,
// KPIs, and dashboards.
//
// Rules (in priority order):
//   1. "archived"       — lifecycle status === "archived" (final resting state)
//   2. "review_required"— lifecycle "review_required" OR processingStatus "needs_review"
//   3. "failed"         — either field is "failed"
//   4. "processing"     — processingStatus is "queued" | "processing" or lifecycle is
//                         "queued" | "extracting"
//   5. "done"           — processingStatus "processed" and not archived/review
//   6. "intake"         — everything else (uploaded, imported, intake_received, etc.)
// ---------------------------------------------------------------------------

export type DocumentDisplayStatus =
  | "archived"
  | "review_required"
  | "failed"
  | "processing"
  | "done"
  | "intake";

export function getDocumentDisplayStatus(doc: Pick<ArchiveDocument, "processingStatus" | "status">): DocumentDisplayStatus {
  const ps = doc.processingStatus;
  const ls = doc.status;

  if (ls === "archived") return "archived";
  if (ls === "review_required" || ps === "needs_review") return "review_required";
  if (ps === "failed" || ls === "failed") return "failed";
  if (ps === "queued" || ps === "processing" || ps === "intake_complete" || ls === "queued" || ls === "extracting") return "processing";
  if (ps === "processed") return "done";
  return "intake";
}
