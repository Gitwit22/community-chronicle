/**
 * Page-First Intake API Client
 *
 * Frontend service for the page-first document architecture endpoints.
 * All requests are authenticated via getAuthHeaders().
 *
 * Feature flag: COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE
 * Set to "true" in env to enable the new upload flow.
 */

import { API_BASE } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/tokenStorage";
import type {
  DocumentPage,
  DocumentPacket,
  DocumentPacketPage,
  PageFirstUploadResponse,
  PatchPageLabelsRequest,
  CreatePacketRequest,
  PatchPacketRequest,
  PageSearchParams,
  PageSearchResult,
  PacketSearchParams,
  PacketSearchResult,
} from "@/types/pageFirstIntake";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as Record<string, unknown>).error)
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────

export interface PageFirstUploadInput {
  orgId: string;
  uploadedById?: string;
  originalFileName: string;
  originalMimeType: string;
  originalFilePath: string;
  originalFileUrl?: string;
  pages: Array<{
    pageNumber: number;
    pageText?: string;
    pageImagePath?: string;
    detectedDocType?: string;
    detectedCompanyOrOrg?: string;
    detectedPersonName?: string;
    detectedMonth?: number;
    detectedYear?: number;
    detectedDate?: string;
    confidence?: number;
    needsReview?: boolean;
  }>;
}

/**
 * Create an OriginalUpload with pre-labeled pages.
 * POST /documents/page-first/upload
 */
export async function apiPageFirstUpload(
  input: PageFirstUploadInput,
): Promise<PageFirstUploadResponse> {
  const response = await fetch(`${API_BASE}/documents/page-first/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  return parseJson<PageFirstUploadResponse>(response);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all DocumentPage records for an upload, ordered by pageNumber.
 * GET /documents/uploads/:uploadId/pages
 */
export async function apiGetUploadPages(uploadId: string): Promise<DocumentPage[]> {
  const response = await fetch(`${API_BASE}/documents/uploads/${uploadId}/pages`, {
    headers: getAuthHeaders(),
  });
  const data = await parseJson<{ pages: DocumentPage[] }>(response);
  return data.pages;
}

/**
 * Update label metadata on a single DocumentPage.
 * PATCH /documents/pages/:pageId/labels
 */
export async function apiPatchPageLabels(
  pageId: string,
  updates: PatchPageLabelsRequest,
): Promise<DocumentPage> {
  const response = await fetch(`${API_BASE}/documents/pages/${pageId}/labels`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  const data = await parseJson<{ page: DocumentPage }>(response);
  return data.page;
}

// ─────────────────────────────────────────────────────────────────────────────
// Packets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all DocumentPacket records for an upload (with their pages).
 * GET /documents/uploads/:uploadId/packets
 */
export async function apiGetUploadPackets(uploadId: string): Promise<DocumentPacket[]> {
  const response = await fetch(`${API_BASE}/documents/uploads/${uploadId}/packets`, {
    headers: getAuthHeaders(),
  });
  const data = await parseJson<{ packets: DocumentPacket[] }>(response);
  return data.packets;
}

/**
 * Manually create a DocumentPacket from selected pageIds.
 * POST /documents/packets
 */
export async function apiCreatePacket(input: CreatePacketRequest): Promise<DocumentPacket> {
  const response = await fetch(`${API_BASE}/documents/packets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ packet: DocumentPacket }>(response);
  return data.packet;
}

/**
 * Edit packet metadata.
 * PATCH /documents/packets/:packetId
 */
export async function apiPatchPacket(
  packetId: string,
  updates: PatchPacketRequest,
): Promise<DocumentPacket> {
  const response = await fetch(`${API_BASE}/documents/packets/${packetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(updates),
  });
  const data = await parseJson<{ packet: DocumentPacket }>(response);
  return data.packet;
}

/**
 * Attach a page to an existing packet.
 * POST /documents/packets/:packetId/pages
 */
export async function apiAttachPageToPacket(
  packetId: string,
  pageId: string,
  relationshipType?: string,
): Promise<DocumentPacketPage> {
  const response = await fetch(`${API_BASE}/documents/packets/${packetId}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ pageId, relationshipType }),
  });
  const data = await parseJson<{ packetPage: DocumentPacketPage }>(response);
  return data.packetPage;
}

/**
 * Detach a page from a packet.
 * DELETE /documents/packets/:packetId/pages/:pageId
 */
export async function apiDetachPageFromPacket(
  packetId: string,
  pageId: string,
): Promise<{ detached: boolean }> {
  const response = await fetch(`${API_BASE}/documents/packets/${packetId}/pages/${pageId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return parseJson<{ detached: boolean }>(response);
}

// ─────────────────────────────────────────────────────────────────────────────
// Regroup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-run the grouping engine on an upload's current page labels.
 * Returns new suggested packets.
 * POST /documents/uploads/:uploadId/regroup
 */
export async function apiRegroupUpload(uploadId: string): Promise<DocumentPacket[]> {
  const response = await fetch(`${API_BASE}/documents/uploads/${uploadId}/regroup`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  const data = await parseJson<{ packets: DocumentPacket[] }>(response);
  return data.packets;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search DocumentPage records by metadata and text.
 * GET /documents/page-search
 */
export async function apiPageSearch(params: PageSearchParams): Promise<PageSearchResult> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.type) query.set("type", params.type);
  if (params.person) query.set("person", params.person);
  if (params.organization) query.set("organization", params.organization);
  if (params.month !== undefined) query.set("month", String(params.month));
  if (params.year !== undefined) query.set("year", String(params.year));
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.packetId) query.set("packetId", params.packetId);
  if (params.uploadId) query.set("uploadId", params.uploadId);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));

  const response = await fetch(`${API_BASE}/documents/page-search?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  return parseJson<PageSearchResult>(response);
}

/**
 * Search DocumentPacket records by metadata.
 * GET /documents/packets/search
 */
export async function apiPacketSearch(params: PacketSearchParams): Promise<PacketSearchResult> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.type) query.set("type", params.type);
  if (params.person) query.set("person", params.person);
  if (params.organization) query.set("organization", params.organization);
  if (params.month !== undefined) query.set("month", String(params.month));
  if (params.year !== undefined) query.set("year", String(params.year));
  if (params.status) query.set("status", params.status);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));

  const response = await fetch(`${API_BASE}/documents/packets/search?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  return parseJson<PacketSearchResult>(response);
}
