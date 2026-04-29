/**
 * Page-first intake types for Community Chronicle.
 *
 * Architecture principle:
 *   The upload is only the container.
 *   The page is the searchable unit.
 *   The packet is the reconstructed relationship between pages.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Status enums
// ─────────────────────────────────────────────────────────────────────────────

export type OriginalUploadStatus =
  | "uploaded"
  | "pending"
  | "splitting"
  | "labeling"
  | "grouping"
  | "review_ready"
  | "approved"
  | "complete"
  | "failed";

export type DocumentPageStatus =
  | "pending"
  | "ocr_complete"
  | "labeled"
  | "reviewed"
  | "failed";

export type DocumentPacketStatus = "suggested" | "approved" | "rejected" | "manually_created";

/** How a page relates to its packet */
export type RelationshipType =
  | "primary"
  | "continuation"
  | "attachment"
  | "receipt_support"
  | "signature_page"
  | "cover_page"
  | "invoice_detail"
  | "unknown";

// ─────────────────────────────────────────────────────────────────────────────
// Core page-first models
// ─────────────────────────────────────────────────────────────────────────────

/** Represents the original uploaded file — the immutable container. */
export interface OriginalUpload {
  id: string;
  orgId: string;
  uploadedById?: string | null;
  originalFileName: string;
  originalMimeType: string;
  originalFilePath: string;
  originalFileUrl?: string | null;
  pageCount: number;
  processingStatus: OriginalUploadStatus;
  createdAt: string;
  updatedAt: string;
}

/** A single page extracted from an OriginalUpload — the searchable unit. */
export interface DocumentPage {
  id: string;
  originalUploadId: string;
  orgId: string;
  pageNumber: number;
  pageImagePath?: string | null;
  pageText?: string | null;
  detectedDocType?: string | null;
  detectedCompanyOrOrg?: string | null;
  detectedPersonName?: string | null;
  detectedMonth?: number | null;
  detectedYear?: number | null;
  detectedDate?: string | null;
  confidence: number;
  needsReview: boolean;
  processingStatus: DocumentPageStatus;
  rawExtractionJson?: unknown;
  createdAt: string;
  updatedAt: string;
}

/** A suggested or confirmed grouping of related pages. */
export interface DocumentPacket {
  id: string;
  orgId: string;
  originalUploadId?: string | null;
  title: string;
  packetType?: string | null;
  primaryCompanyOrOrg?: string | null;
  primaryPersonName?: string | null;
  detectedMonth?: number | null;
  detectedYear?: number | null;
  confidence: number;
  needsReview: boolean;
  status: DocumentPacketStatus;
  createdAt: string;
  updatedAt: string;
  pages?: DocumentPacketPage[];
}

/** Join record linking a DocumentPage to a DocumentPacket. */
export interface DocumentPacketPage {
  id: string;
  packetId: string;
  pageId: string;
  orderIndex: number;
  relationshipType: RelationshipType;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Labeling and grouping
// ─────────────────────────────────────────────────────────────────────────────

/** Result of labeling a single page. */
export interface PageLabel {
  detectedDocType: string | null;
  detectedCompanyOrOrg: string | null;
  detectedPersonName: string | null;
  detectedMonth: number | null;
  detectedYear: number | null;
  detectedDate: string | null;
  confidence: number;
  needsReview: boolean;
  warnings: string[];
}

/** A page with its assigned label, used as input to the grouping engine. */
export interface LabeledPage {
  pageNumber: number;
  pageId?: string;
  pageText: string;
  label: PageLabel;
}

/** A group of pages proposed as a single packet. */
export interface ProposedPacket {
  title: string;
  packetType: string | null;
  primaryCompanyOrOrg: string | null;
  primaryPersonName: string | null;
  detectedMonth: number | null;
  detectedYear: number | null;
  confidence: number;
  needsReview: boolean;
  pages: Array<{
    pageNumber: number;
    pageId?: string;
    orderIndex: number;
    relationshipType: RelationshipType;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// API request / response shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface PageFirstUploadResponse {
  originalUploadId: string;
  pageCount: number;
  processingStatus: OriginalUploadStatus;
}

export interface PatchPageLabelsRequest {
  detectedDocType?: string | null;
  detectedCompanyOrOrg?: string | null;
  detectedPersonName?: string | null;
  detectedMonth?: number | null;
  detectedYear?: number | null;
  detectedDate?: string | null;
  needsReview?: boolean;
}

export interface CreatePacketRequest {
  orgId: string;
  originalUploadId?: string;
  title: string;
  packetType?: string;
  pageIds: string[];
}

export interface PatchPacketRequest {
  title?: string;
  packetType?: string;
  primaryCompanyOrOrg?: string | null;
  primaryPersonName?: string | null;
  detectedMonth?: number | null;
  detectedYear?: number | null;
  status?: DocumentPacketStatus;
}

export interface PageSearchParams {
  q?: string;
  type?: string;
  person?: string;
  organization?: string;
  month?: number;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
  packetId?: string;
  uploadId?: string;
  limit?: number;
  offset?: number;
}

export interface PageSearchResult {
  pages: DocumentPage[];
  total: number;
  limit: number;
  offset: number;
}

export interface PacketSearchParams {
  q?: string;
  type?: string;
  person?: string;
  organization?: string;
  month?: number;
  year?: number;
  status?: DocumentPacketStatus;
  limit?: number;
  offset?: number;
}

export interface PacketSearchResult {
  packets: DocumentPacket[];
  total: number;
  limit: number;
  offset: number;
}
