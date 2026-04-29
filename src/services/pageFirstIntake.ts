/**
 * Page-First Intake Service
 *
 * Core processing logic for the page-first document architecture.
 *
 * Architecture principle:
 *   The upload is only the container.
 *   The page is the searchable unit.
 *   The packet is the reconstructed relationship between pages.
 *
 * All functions are pure / deterministic so they are easily testable.
 * Prisma database operations live in the backend API route handler.
 *
 * Exposed functions:
 *   labelPageMetadata(pageText, filename?, pageNumber?)
 *   suggestDocumentPackets(labeledPages)
 */

import type { PageLabel, LabeledPage, ProposedPacket, RelationshipType } from "@/types/pageFirstIntake";
import { extractYear, extractMonth } from "@/services/filenameParser";

// ─────────────────────────────────────────────────────────────────────────────
// Document type keywords
// ─────────────────────────────────────────────────────────────────────────────

const DOC_TYPE_RULES: Array<{ type: string; keywords: string[]; weight: number }> = [
  {
    type: "invoice",
    keywords: ["invoice", "amount due", "balance due", "bill to", "remit to", "invoice #", "invoice no", "total due"],
    weight: 1.0,
  },
  {
    type: "receipt",
    keywords: ["receipt", "thank you for your payment", "payment received", "transaction id", "order confirmed"],
    weight: 1.0,
  },
  {
    type: "voucher",
    keywords: ["voucher", "voucher #", "voucher no", "payment voucher", "vendor voucher"],
    weight: 1.0,
  },
  {
    type: "check",
    keywords: ["pay to the order of", "memo", "check no", "check number", "routing number", "account number"],
    weight: 1.0,
  },
  {
    type: "deposit_summary",
    keywords: ["deposit", "deposit summary", "total deposits", "deposit slip", "deposits received"],
    weight: 1.0,
  },
  {
    type: "payroll",
    keywords: ["payroll", "pay stub", "pay period", "gross pay", "net pay", "adp", "direct deposit", "wages", "hours worked"],
    weight: 1.0,
  },
  {
    type: "grant",
    keywords: ["grant", "grant award", "grant agreement", "grant period", "funding award", "grant amount"],
    weight: 1.0,
  },
  {
    type: "donation",
    keywords: ["donation", "donor", "gift of", "your gift", "your donation", "pledge", "tribute", "charitable contribution", "acknowledgment"],
    weight: 0.9,
  },
  {
    type: "bank_statement",
    keywords: ["bank statement", "statement of account", "account balance", "beginning balance", "ending balance", "account summary"],
    weight: 1.0,
  },
  {
    type: "minutes",
    keywords: ["minutes", "meeting minutes", "board meeting", "agenda", "attendees", "motion", "quorum", "adjourned"],
    weight: 1.0,
  },
  {
    type: "sign_in_sheet",
    keywords: ["sign in", "sign-in", "signin", "attendance sheet", "sign in sheet", "name / signature", "printed name"],
    weight: 1.0,
  },
  {
    type: "letter",
    keywords: ["dear ", "sincerely", "yours truly", "best regards", "to whom it may concern"],
    weight: 0.8,
  },
  {
    type: "report",
    keywords: ["executive summary", "prepared by", "submitted to", "findings", "recommendations", "analysis"],
    weight: 0.7,
  },
  {
    type: "form",
    keywords: ["please complete", "please fill", "application form", "registration form", "form #", "authorization form"],
    weight: 0.9,
  },
  {
    type: "tax",
    keywords: ["1099", "w-2", "w2", "irs", "tax return", "federal income tax", "tax year", "taxpayer"],
    weight: 1.0,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Organization / company detection
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns to identify likely organization names from page text. */
const ORG_INDICATOR_PATTERNS = [
  // "Inc.", "LLC", "Corp.", "Co.", "Foundation", "Association", etc.
  /\b([A-Z][A-Za-z0-9&.,'\s]{2,50}(?:Inc\.?|LLC\.?|Corp\.?|Co\.?|Ltd\.?|Foundation|Association|Organization|Society|Institute|Council|Center|Centre|Nonprofit|Non-?profit|Charity|Ministries|Church|School|University|College|Hospital|Authority))\b/g,
  // "of [Location]" org patterns
  /\b([A-Z][A-Za-z0-9&.\s]{2,40}\s+of\s+[A-Z][A-Za-z\s]{2,30})\b/g,
];

/**
 * Attempt to detect an organization or company name from page text.
 * Returns the first plausible match, or null.
 */
function detectOrgFromText(text: string): string | null {
  for (const pattern of ORG_INDICATOR_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const candidate = match[1].replace(/\s+/g, " ").trim();
      if (candidate.length >= 4 && candidate.length <= 80) {
        return candidate;
      }
    }
    // Reset stateful regex
    pattern.lastIndex = 0;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Person name detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple heuristic to detect person names.
 * Looks for "Name:", "Payee:", "Customer:", "Donor:", "Staff:", "Employee:"
 * label patterns, then grabs the following capitalized words.
 */
const PERSON_LABEL_REGEX =
  /(?:^|\n)\s*(?:name|payee|customer|donor|staff|employee|recipient|contact|member|attendee|participant|to|from)\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:\s*\n|$)/gim;

function detectPersonFromText(text: string): string | null {
  PERSON_LABEL_REGEX.lastIndex = 0;
  const match = PERSON_LABEL_REGEX.exec(text);
  if (match) {
    const name = match[1].trim();
    // Reject if it looks like an org/sentence fragment
    if (name.length >= 3 && name.length <= 60 && !name.includes(",")) {
      return name;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date detection
// ─────────────────────────────────────────────────────────────────────────────

const DATE_PATTERNS: RegExp[] = [
  // MM/DD/YYYY or MM-DD-YYYY
  /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](20\d{2})\b/,
  // Month DD, YYYY
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*20\d{2}\b/i,
  // DD Month YYYY
  /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b/i,
  // YYYY-MM-DD (ISO)
  /\b20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/,
];

function detectDateFromText(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Continuation/cover/signature signals
// ─────────────────────────────────────────────────────────────────────────────

const CONTINUATION_PHRASES = [
  "continued",
  "cont'd",
  "cont.",
  "page 2",
  "page 3",
  "page 4",
  "page 5",
  "- continued",
  "continued on next",
  "continued from",
];

const SIGNATURE_PHRASES = [
  "signature",
  "sign here",
  "authorized signature",
  "witness",
  "notary",
  "sworn",
];

const COVER_PHRASES = [
  "cover page",
  "cover sheet",
  "transmittal",
  "this packet contains",
  "table of contents",
];

const ATTACHMENT_PHRASES = [
  "attachment",
  "exhibit",
  "appendix",
  "enclosure",
  "enclosed",
  "see attached",
];

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

// ─────────────────────────────────────────────────────────────────────────────
// Core labeling function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract lightweight metadata from a single page's text.
 *
 * Uses deterministic rule-based logic:
 * - Filename hints (when provided)
 * - Document type keywords
 * - Date regex patterns
 * - Month/year detection
 * - Organization/company patterns
 * - Person name patterns
 *
 * This is a fast labeling pass — not full form parsing.
 */
export function labelPageMetadata(
  pageText: string,
  filename?: string,
  pageNumber?: number,
): PageLabel {
  const warnings: string[] = [];
  const combinedText = [filename ?? "", pageText].join(" ");

  // ── Document type ───────────────────────────────────────────────
  let detectedDocType: string | null = null;
  let docTypeScore = 0;
  const lower = combinedText.toLowerCase();

  for (const rule of DOC_TYPE_RULES) {
    let matches = 0;
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) matches++;
    }
    if (matches > 0) {
      const score = (matches / rule.keywords.length) * rule.weight;
      if (score > docTypeScore) {
        docTypeScore = score;
        detectedDocType = rule.type;
      }
    }
  }

  // ── Date / month / year ─────────────────────────────────────────
  const detectedDate = detectDateFromText(pageText);
  const yearFromContent = extractYear(pageText);
  const monthFromContent = extractMonth(pageText);
  const yearFromFilename = filename ? extractYear(filename) : undefined;
  const monthFromFilename = filename ? extractMonth(filename) : undefined;

  const detectedYear = yearFromFilename ?? yearFromContent ?? null;
  const detectedMonth = monthFromFilename?.month ?? monthFromContent?.month ?? null;

  // ── Organization / company ──────────────────────────────────────
  const detectedCompanyOrOrg = detectOrgFromText(pageText);

  // ── Person name ─────────────────────────────────────────────────
  const detectedPersonName = detectPersonFromText(pageText);

  // ── Confidence ──────────────────────────────────────────────────
  const fieldsFilled = [
    detectedDocType,
    detectedYear,
    detectedMonth,
    detectedDate,
    detectedCompanyOrOrg,
    detectedPersonName,
  ].filter((v) => v !== null).length;

  let confidence = Math.min((fieldsFilled / 6) * 0.8 + docTypeScore * 0.2, 1.0);

  const isBlankPage = pageText.trim().length < 30;
  if (isBlankPage) {
    confidence = Math.min(confidence, 0.2);
    warnings.push("Page appears to be blank or nearly empty.");
  }

  const needsReview =
    confidence < 0.3 ||
    detectedDocType === null ||
    (pageNumber === 1 && fieldsFilled < 2);

  if (needsReview) {
    warnings.push("Low confidence — manual review recommended.");
  }

  return {
    detectedDocType,
    detectedCompanyOrOrg,
    detectedPersonName,
    detectedMonth,
    detectedYear,
    detectedDate,
    confidence,
    needsReview,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Grouping engine
// ─────────────────────────────────────────────────────────────────────────────

/** Compare two nullable values for "same group" equality. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

/** Return true when two labels suggest the pages belong in the same packet. */
function sameBucket(a: PageLabel, b: PageLabel): boolean {
  // If doc types are set and differ → different packet
  if (a.detectedDocType && b.detectedDocType && !sameValue(a.detectedDocType, b.detectedDocType)) {
    return false;
  }
  // If both company/org are set and differ → different packet
  if (a.detectedCompanyOrOrg && b.detectedCompanyOrOrg && !sameValue(a.detectedCompanyOrOrg, b.detectedCompanyOrOrg)) {
    return false;
  }
  // If both person are set and differ → different packet
  if (a.detectedPersonName && b.detectedPersonName && !sameValue(a.detectedPersonName, b.detectedPersonName)) {
    return false;
  }
  // If year is set and differs → different packet
  if (a.detectedYear && b.detectedYear && a.detectedYear !== b.detectedYear) {
    return false;
  }
  // Continuation / structural signals always attach to previous
  return true;
}

/**
 * Determine the relationship type for a page relative to its packet.
 */
function determineRelationshipType(
  page: LabeledPage,
  packetFirstLabel: PageLabel,
  isFirstPage: boolean,
): RelationshipType {
  if (isFirstPage) return "primary";
  const text = page.pageText ?? "";
  if (hasCoverSignal(text)) return "cover_page";
  if (hasSignatureSignal(text)) return "signature_page";
  if (hasAttachmentSignal(text)) return "attachment";
  if (hasContinuationSignal(text)) return "continuation";
  // If doc type matches "invoice_detail" pattern
  if (
    page.label.detectedDocType === "invoice" &&
    packetFirstLabel.detectedDocType === "voucher"
  ) {
    return "invoice_detail";
  }
  if (
    page.label.detectedDocType === "receipt" &&
    packetFirstLabel.detectedDocType !== "receipt"
  ) {
    return "receipt_support";
  }
  return "continuation";
}

/**
 * Suggest document packets from an ordered list of labeled pages.
 *
 * Signals used:
 * - Same detectedDocType, company/org, person, month/year → same packet
 * - Continuation phrases → attach to previous packet
 * - Abrupt company/type/date change → start a new packet
 * - Low-confidence pages → mark packet as needsReview
 *
 * Returns an array of ProposedPacket objects with ordered page lists.
 */
export function suggestDocumentPackets(labeledPages: LabeledPage[]): ProposedPacket[] {
  if (labeledPages.length === 0) return [];

  const packets: ProposedPacket[] = [];
  let currentPacket: ProposedPacket | null = null;

  for (const page of labeledPages) {
    const isContinuation =
      hasContinuationSignal(page.pageText ?? "") ||
      hasSignatureSignal(page.pageText ?? "") ||
      hasAttachmentSignal(page.pageText ?? "");

    // Check if this page belongs in the current packet
    const shouldAttach =
      currentPacket !== null &&
      (isContinuation || sameBucket(currentPacket.pages.length > 0
        ? getLabelForRelationship(currentPacket, labeledPages)
        : page.label, page.label));

    if (!shouldAttach || currentPacket === null) {
      // Start a new packet
      const label = page.label;
      currentPacket = {
        title: buildPacketTitle(label, packets.length + 1),
        packetType: label.detectedDocType,
        primaryCompanyOrOrg: label.detectedCompanyOrOrg,
        primaryPersonName: label.detectedPersonName,
        detectedMonth: label.detectedMonth,
        detectedYear: label.detectedYear,
        confidence: label.confidence,
        needsReview: label.needsReview,
        pages: [
          {
            pageNumber: page.pageNumber,
            pageId: page.pageId,
            orderIndex: 0,
            relationshipType: "primary",
          },
        ],
      };
      packets.push(currentPacket);
    } else {
      // Attach to current packet
      const firstLabel = getFirstPageLabel(currentPacket, labeledPages);
      const relationshipType = determineRelationshipType(page, firstLabel, false);

      currentPacket.pages.push({
        pageNumber: page.pageNumber,
        pageId: page.pageId,
        orderIndex: currentPacket.pages.length,
        relationshipType,
      });

      // Update packet-level confidence (average)
      currentPacket.confidence =
        (currentPacket.confidence * (currentPacket.pages.length - 1) + page.label.confidence) /
        currentPacket.pages.length;

      // Escalate needsReview if any page is uncertain
      if (page.label.needsReview) {
        currentPacket.needsReview = true;
      }

      // Fill in missing packet metadata from later pages
      if (!currentPacket.primaryCompanyOrOrg && page.label.detectedCompanyOrOrg) {
        currentPacket.primaryCompanyOrOrg = page.label.detectedCompanyOrOrg;
      }
      if (!currentPacket.primaryPersonName && page.label.detectedPersonName) {
        currentPacket.primaryPersonName = page.label.detectedPersonName;
      }
      if (!currentPacket.detectedMonth && page.label.detectedMonth) {
        currentPacket.detectedMonth = page.label.detectedMonth;
      }
      if (!currentPacket.detectedYear && page.label.detectedYear) {
        currentPacket.detectedYear = page.label.detectedYear;
      }
    }
  }

  return packets;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildPacketTitle(label: PageLabel, index: number): string {
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

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function getFirstPageLabel(packet: ProposedPacket, allPages: LabeledPage[]): PageLabel {
  const firstEntry = packet.pages[0];
  const found = allPages.find((p) => p.pageNumber === firstEntry.pageNumber);
  return found?.label ?? {
    detectedDocType: packet.packetType,
    detectedCompanyOrOrg: packet.primaryCompanyOrOrg,
    detectedPersonName: packet.primaryPersonName,
    detectedMonth: packet.detectedMonth,
    detectedYear: packet.detectedYear,
    detectedDate: null,
    confidence: packet.confidence,
    needsReview: packet.needsReview,
    warnings: [],
  };
}

function getLabelForRelationship(packet: ProposedPacket, allPages: LabeledPage[]): PageLabel {
  return getFirstPageLabel(packet, allPages);
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience pipeline helpers (called by backend route handler)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Label each page in a list of (pageNumber, pageText) tuples.
 * Returns labeled pages ready for the grouping engine.
 */
export function labelAllPages(
  pages: Array<{ pageNumber: number; pageId?: string; pageText: string }>,
  filename?: string,
): LabeledPage[] {
  return pages.map((p) => ({
    pageNumber: p.pageNumber,
    pageId: p.pageId,
    pageText: p.pageText,
    label: labelPageMetadata(p.pageText, filename, p.pageNumber),
  }));
}
