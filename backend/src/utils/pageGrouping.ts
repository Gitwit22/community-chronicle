/**
 * Page grouping utility for the backend (no frontend/path-alias dependencies).
 *
 * Mirrors the logic in src/services/pageFirstIntake.ts.
 * Must not import from @/* path aliases — this file runs in Node.js backend context.
 */

export type RelationshipType =
  | "primary"
  | "continuation"
  | "attachment"
  | "receipt_support"
  | "signature_page"
  | "cover_page"
  | "invoice_detail"
  | "unknown";

export interface StoredPageLabel {
  detectedDocType: string | null;
  detectedCompanyOrOrg: string | null;
  detectedPersonName: string | null;
  detectedMonth: number | null;
  detectedYear: number | null;
  detectedDate: string | null;
  confidence: number;
  needsReview: boolean;
}

export interface LabeledPageInput {
  pageNumber: number;
  pageId: string;
  pageText: string;
  label: StoredPageLabel;
}

export interface ProposedPacketOutput {
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
    pageId: string;
    orderIndex: number;
    relationshipType: RelationshipType;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal detection helpers
// ─────────────────────────────────────────────────────────────────────────────

const CONTINUATION_PHRASES = ["continued", "cont'd", "cont.", "page 2", "page 3", "page 4", "page 5", "- continued", "continued on next", "continued from"];
const SIGNATURE_PHRASES = ["signature", "sign here", "authorized signature", "witness", "notary", "sworn"];
const COVER_PHRASES = ["cover page", "cover sheet", "transmittal", "this packet contains", "table of contents"];
const ATTACHMENT_PHRASES = ["attachment", "exhibit", "appendix", "enclosure", "enclosed", "see attached"];

function hasContinuationSignal(text: string): boolean {
  const lower = text.toLowerCase().slice(0, 500);
  return CONTINUATION_PHRASES.some((p) => lower.includes(p));
}

function hasSignatureSignal(text: string): boolean {
  const lower = text.toLowerCase().slice(0, 500);
  return SIGNATURE_PHRASES.some((p) => lower.includes(p));
}

function hasCoverSignal(text: string): boolean {
  const lower = text.toLowerCase().slice(0, 500);
  return COVER_PHRASES.some((p) => lower.includes(p));
}

function hasAttachmentSignal(text: string): boolean {
  const lower = text.toLowerCase().slice(0, 500);
  return ATTACHMENT_PHRASES.some((p) => lower.includes(p));
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

function sameBucket(a: StoredPageLabel, b: StoredPageLabel): boolean {
  if (a.detectedDocType && b.detectedDocType && !sameValue(a.detectedDocType, b.detectedDocType)) return false;
  if (a.detectedCompanyOrOrg && b.detectedCompanyOrOrg && !sameValue(a.detectedCompanyOrOrg, b.detectedCompanyOrOrg)) return false;
  if (a.detectedPersonName && b.detectedPersonName && !sameValue(a.detectedPersonName, b.detectedPersonName)) return false;
  if (a.detectedYear && b.detectedYear && a.detectedYear !== b.detectedYear) return false;
  return true;
}

function determineRelationshipType(
  page: LabeledPageInput,
  packetFirstLabel: StoredPageLabel,
  isFirstPage: boolean,
): RelationshipType {
  if (isFirstPage) return "primary";
  const text = page.pageText ?? "";
  if (hasCoverSignal(text)) return "cover_page";
  if (hasSignatureSignal(text)) return "signature_page";
  if (hasAttachmentSignal(text)) return "attachment";
  if (hasContinuationSignal(text)) return "continuation";
  if (page.label.detectedDocType === "invoice" && packetFirstLabel.detectedDocType === "voucher") return "invoice_detail";
  if (page.label.detectedDocType === "receipt" && packetFirstLabel.detectedDocType !== "receipt") return "receipt_support";
  return "continuation";
}

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPacketTitle(label: StoredPageLabel, index: number): string {
  const parts: string[] = [];
  if (label.detectedDocType) parts.push(capitalizeWords(label.detectedDocType.replace(/_/g, " ")));
  if (label.detectedCompanyOrOrg) parts.push(label.detectedCompanyOrOrg);
  if (label.detectedPersonName) parts.push(label.detectedPersonName);
  if (label.detectedMonth && label.detectedYear) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    parts.push(`${monthNames[label.detectedMonth - 1]} ${label.detectedYear}`);
  } else if (label.detectedYear) {
    parts.push(String(label.detectedYear));
  }
  return parts.length > 0 ? parts.join(" — ") : `Packet ${index}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main grouping function
// ─────────────────────────────────────────────────────────────────────────────

export function suggestDocumentPackets(labeledPages: LabeledPageInput[]): ProposedPacketOutput[] {
  if (labeledPages.length === 0) return [];

  const packets: ProposedPacketOutput[] = [];
  let currentPacket: ProposedPacketOutput | null = null;

  for (const page of labeledPages) {
    const isContinuation =
      hasContinuationSignal(page.pageText) ||
      hasSignatureSignal(page.pageText) ||
      hasAttachmentSignal(page.pageText);

    const currentFirstLabel: StoredPageLabel | null = currentPacket
      ? (labeledPages.find((p) => p.pageNumber === currentPacket!.pages[0].pageNumber)?.label ?? null)
      : null;

    const shouldAttach =
      currentPacket !== null &&
      (isContinuation || (currentFirstLabel !== null && sameBucket(currentFirstLabel, page.label)));

    if (!shouldAttach || currentPacket === null) {
      currentPacket = {
        title: buildPacketTitle(page.label, packets.length + 1),
        packetType: page.label.detectedDocType,
        primaryCompanyOrOrg: page.label.detectedCompanyOrOrg,
        primaryPersonName: page.label.detectedPersonName,
        detectedMonth: page.label.detectedMonth,
        detectedYear: page.label.detectedYear,
        confidence: page.label.confidence,
        needsReview: page.label.needsReview,
        pages: [{ pageNumber: page.pageNumber, pageId: page.pageId, orderIndex: 0, relationshipType: "primary" }],
      };
      packets.push(currentPacket);
    } else {
      const firstLabel = currentFirstLabel!;
      const relationshipType = determineRelationshipType(page, firstLabel, false);

      currentPacket.pages.push({
        pageNumber: page.pageNumber,
        pageId: page.pageId,
        orderIndex: currentPacket.pages.length,
        relationshipType,
      });

      currentPacket.confidence =
        (currentPacket.confidence * (currentPacket.pages.length - 1) + page.label.confidence) /
        currentPacket.pages.length;

      if (page.label.needsReview) currentPacket.needsReview = true;
      if (!currentPacket.primaryCompanyOrOrg && page.label.detectedCompanyOrOrg) currentPacket.primaryCompanyOrOrg = page.label.detectedCompanyOrOrg;
      if (!currentPacket.primaryPersonName && page.label.detectedPersonName) currentPacket.primaryPersonName = page.label.detectedPersonName;
      if (!currentPacket.detectedMonth && page.label.detectedMonth) currentPacket.detectedMonth = page.label.detectedMonth;
      if (!currentPacket.detectedYear && page.label.detectedYear) currentPacket.detectedYear = page.label.detectedYear;
    }
  }

  return packets;
}
