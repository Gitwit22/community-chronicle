/**
 * Document Type Classifier — community-chronicle frontend
 *
 * Lightweight, rule-based classifier that runs in the browser during upload
 * for instant feedback.  The server also runs the same logic on the extracted
 * text after processing, so this is a best-effort preview only.
 *
 * This replaces the heavy extractionRoutingService → coreApiClient → Llama schema
 * extraction path for the default intake workflow.
 *
 * Classification types:
 *   invoice | receipt | letter | form | sign_in_sheet |
 *   business_card | report | notice | other_unclassified
 */

import type { SystemDocType, LightweightDocumentMetadata } from "@/types/document";
import { SYSTEM_DOC_TYPE_LABELS } from "@/types/document";

// ---------------------------------------------------------------------------
// Keyword rules
// ---------------------------------------------------------------------------

interface TypeRule {
  type: SystemDocType;
  keywords: string[];
  weight: number;
}

const TYPE_RULES: TypeRule[] = [
  {
    type: "invoice",
    keywords: [
      "invoice", "invoice #", "invoice number", "bill to", "amount due",
      "balance due", "total due", "remit payment", "due date", "net 30",
      "net 60", "purchase order", "line item", "qty", "quantity", "unit price",
      "subtotal", "tax amount", "vendor", "billing address",
    ],
    weight: 1.0,
  },
  {
    type: "receipt",
    keywords: [
      "receipt", "acknowledgment", "acknowledgement", "thank you for your",
      "your gift", "your donation", "your contribution", "payment received",
      "total received", "we received", "tax deductible", "501(c)(3)",
      "charitable contribution", "non-cash contribution", "in-kind",
      "no goods or services", "donation amount",
    ],
    weight: 1.0,
  },
  {
    type: "letter",
    keywords: [
      "dear ", "sincerely", "regards,", "to whom it may concern",
      "on behalf of", "we are pleased", "we regret", "we would like",
      "please find enclosed", "please find attached", "letter of",
      "re:", "memorandum",
    ],
    weight: 0.9,
  },
  {
    type: "form",
    keywords: [
      "application", "please complete", "please fill", "submit",
      "applicant name", "signature", "date signed", "authorized by",
      "registration", "enrollment", "pledge form", "pledge card",
      "credit card authorization", "w-9", "w9", "i-9",
    ],
    weight: 1.0,
  },
  {
    type: "sign_in_sheet",
    keywords: [
      "sign-in", "sign in sheet", "attendance", "attendees", "roster",
      "participant list", "name:", "signature:", "present:", "in attendance",
      "meeting attendance", "printed name", "sign here",
    ],
    weight: 1.0,
  },
  {
    type: "business_card",
    keywords: [
      "cell:", "mobile:", "office:", "fax:", "www.", "linkedin",
      "title:", "position:", "direct:", "ext.",
    ],
    weight: 0.7,
  },
  {
    type: "report",
    keywords: [
      "report", "findings", "analysis", "assessment", "evaluation",
      "summary", "executive summary", "introduction", "methodology",
      "conclusion", "recommendation", "data", "study", "research",
      "annual report", "quarterly report", "program report",
    ],
    weight: 0.8,
  },
  {
    type: "notice",
    keywords: [
      "notice", "official notice", "department of", "internal revenue service",
      "irs", "department of the treasury", "notice date", "tax notice",
      "you are required", "you must", "failure to comply", "penalty",
      "pursuant to", "ordinance", "statute", "regulation",
    ],
    weight: 1.0,
  },
];

const CONFIDENCE_THRESHOLD = 0.25;

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export interface ClassificationResult {
  documentType: SystemDocType | string;
  label: string;
  confidence: number;
  classificationStatus: "known" | "other_unclassified";
  classificationMatchedBy: "rule" | "keyword" | "filename";
}

export function classifyDocumentType(
  text: string,
  filename?: string,
): ClassificationResult {
  const corpus = `${filename ?? ""}\n${text}`.toLowerCase();

  // Fast path: filename heuristics
  if (filename) {
    const fn = filename.toLowerCase();
    if (fn.includes("invoice") || fn.includes("inv_") || fn.match(/\binv\b/)) {
      return makeResult("invoice", 0.75, "filename");
    }
    if (fn.includes("receipt") || fn.includes("ack") || fn.includes("acknowledgment")) {
      return makeResult("receipt", 0.75, "filename");
    }
    if (fn.includes("sign_in") || fn.includes("signin") || fn.includes("roster") || fn.includes("attendance")) {
      return makeResult("sign_in_sheet", 0.80, "filename");
    }
    if (fn.includes("business_card") || fn.includes("vcard") || fn.includes("bcard")) {
      return makeResult("business_card", 0.80, "filename");
    }
  }

  // Keyword scoring
  const scores: Array<{ type: SystemDocType; score: number }> = [];
  for (const rule of TYPE_RULES) {
    let hits = 0;
    for (const kw of rule.keywords) {
      if (corpus.includes(kw)) hits++;
    }
    if (hits > 0) {
      scores.push({ type: rule.type, score: (hits / rule.keywords.length) * rule.weight });
    }
  }
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (!best || best.score < CONFIDENCE_THRESHOLD) {
    return makeResult("other_unclassified", best?.score ?? 0, "keyword");
  }

  const confidence = Math.min(best.score + 0.2, 0.95);
  return makeResult(best.type, confidence, "keyword");
}

function makeResult(
  type: SystemDocType | string,
  confidence: number,
  matchedBy: "rule" | "keyword" | "filename",
): ClassificationResult {
  const label = SYSTEM_DOC_TYPE_LABELS[type as SystemDocType] ?? type;
  return {
    documentType: type,
    label,
    confidence,
    classificationStatus: type === "other_unclassified" ? "other_unclassified" : "known",
    classificationMatchedBy: matchedBy,
  };
}

// ---------------------------------------------------------------------------
// Lightweight metadata extraction (browser-side preview, mirrors server logic)
// ---------------------------------------------------------------------------

export function extractLightweightPreview(
  text: string,
  filename?: string,
): LightweightDocumentMetadata {
  const classification = classifyDocumentType(text, filename);

  const documentDate = extractDocumentDate(text);
  const sourceName = extractSourceName(text);
  const people = extractPeople(text);
  const companies = extractCompanies(text);
  const referenceNumbers = extractReferenceNumbers(text);

  return {
    documentType: classification.documentType,
    sourceName,
    documentDate,
    people,
    companies,
    locations: [],
    referenceNumbers,
    other: [],
    confidence: {
      documentType: classification.confidence,
      sourceName: sourceName ? 0.7 : 0,
      documentDate: documentDate ? 0.8 : 0,
    },
  };
}

function extractDocumentDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/)?.[1];
  if (iso) return iso;

  const longDate = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+20\d{2}\b/i,
  )?.[0];
  if (longDate) return longDate;

  const slashDate = text.match(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(20\d{2})\b/)?.[0];
  if (slashDate) return slashDate;

  return null;
}

function extractSourceName(text: string): string | null {
  const from = text.match(/^from:\s*(.+)$/im)?.[1]?.trim();
  if (from && from.length > 2 && from.length < 100) return from;

  const knownIssuers = [
    "Internal Revenue Service", "IRS", "Department of the Treasury",
    "State of Michigan", "City of Detroit", "ADP", "PayPal", "FrontStream",
  ];
  for (const issuer of knownIssuers) {
    if (text.toLowerCase().includes(issuer.toLowerCase())) return issuer;
  }

  return null;
}

function extractPeople(text: string): string[] {
  const dear = [...text.matchAll(/\bDear\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),/g)].map((m) => m[1]);
  return [...new Set(dear)].filter(Boolean).slice(0, 10);
}

function extractCompanies(text: string): string[] {
  const matches: string[] = [];
  const pattern = /\b([A-Z][A-Za-z\s&,.'()-]{3,60}?)\s+(?:Inc\.?|LLC|LLP|Corp\.?|Foundation|Committee|Board|Department|University|School|Council|Association|Organization|Institute)\b/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    matches.push(m[0].trim());
  }
  return [...new Set(matches)].slice(0, 8);
}

function extractReferenceNumbers(text: string): string[] {
  const matches: string[] = [];
  const patterns = [
    /(?:invoice\s*#?|inv\.?\s*#?)[:\s]*([A-Z0-9-]{3,25})/gi,
    /(?:check\s*#?|check\s*no\.?\s*)[:\s]*([A-Z0-9-]{3,20})/gi,
    /(?:grant\s*#?|award\s*#?)[:\s]*([A-Z0-9-]{3,25})/gi,
    /(?:reference\s*#?|ref\.?\s*#?)[:\s]*([A-Z0-9-]{3,25})/gi,
    /(?:account\s*#?|acct\.?\s*#?)[:\s]*([A-Z0-9-]{3,25})/gi,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const ref = m[1]?.trim();
      if (ref && ref.length >= 3) matches.push(ref);
    }
  }
  return [...new Set(matches)].slice(0, 10);
}

// ---------------------------------------------------------------------------
// Utility: get a human-readable label for any doc type key
// ---------------------------------------------------------------------------

export function getDocumentTypeLabel(key: string | null | undefined): string {
  if (!key) return "Unknown";
  return SYSTEM_DOC_TYPE_LABELS[key as SystemDocType] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export { SYSTEM_DOC_TYPE_LABELS };
