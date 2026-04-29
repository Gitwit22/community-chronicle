/**
 * Page-First Upload Service
 *
 * Shared client-side handler for the page-first intake pipeline.
 *
 * Processing sequence:
 *   File → extract per-page text → label pages → POST /documents/page-first/upload
 *        → PageFirstUploadResponse (originalUploadId, pageCount, processingStatus)
 *
 * This service is used by UploadDialog (and any other future upload entry point)
 * when VITE_COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE === "true".
 */

import { extractPdfPageTexts } from "@/services/extractorAdapters/pdfExtractor";
import { labelAllPages } from "@/services/pageFirstIntake";
import { apiPageFirstUpload } from "@/services/apiPageFirstIntake";
import { normalizeExtractedText } from "@/services/textExtractor";
import type { PageFirstUploadResponse } from "@/types/pageFirstIntake";

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE_FIRST_INTAKE_ENABLED =
  (import.meta.env.VITE_COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE as string | undefined) === "true";

// ─────────────────────────────────────────────────────────────────────────────
// Per-file pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process a single file through the page-first intake pipeline:
 * 1. Extract per-page text (PDF → per-page, other → single page)
 * 2. Label each page using deterministic rules
 * 3. POST to /documents/page-first/upload
 * 4. Return the upload response
 *
 * @param file         The file to process.
 * @param orgId        The organization ID (required by the backend).
 * @param uploadedById Optional user ID.
 */
export async function processFileForPageFirst(
  file: File,
  orgId: string,
  uploadedById?: string,
): Promise<PageFirstUploadResponse> {
  // ── 1. Extract per-page text ────────────────────────────────────────────────

  let pageTexts: string[];

  if (file.type === "application/pdf") {
    pageTexts = await extractPdfPageTexts(file);
  } else {
    // For image/text files, run existing extraction and treat result as one page.
    // Use FileReader as fallback when Blob.text() is not available (older jsdom).
    try {
      const raw: string = typeof file.text === "function"
        ? await file.text()
        : await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          });
      pageTexts = [normalizeExtractedText(raw)];
    } catch {
      pageTexts = [""];
    }
  }

  // Guard: always have at least one page
  if (pageTexts.length === 0) {
    pageTexts = [""];
  }

  // ── 2. Label pages ─────────────────────────────────────────────────────────

  const rawPages = pageTexts.map((text, i) => ({
    pageNumber: i + 1,
    pageText: text,
  }));

  const labeled = labelAllPages(rawPages, file.name);

  // ── 3. Upload ───────────────────────────────────────────────────────────────

  return apiPageFirstUpload({
    orgId,
    uploadedById,
    originalFileName: file.name,
    originalMimeType: file.type || "application/octet-stream",
    // Use filename as the path placeholder — actual R2 storage is backend-side
    originalFilePath: file.name,
    pages: labeled.map((lp) => ({
      pageNumber: lp.pageNumber,
      pageText: lp.pageText,
      detectedDocType: lp.label.detectedDocType ?? undefined,
      detectedCompanyOrOrg: lp.label.detectedCompanyOrOrg ?? undefined,
      detectedPersonName: lp.label.detectedPersonName ?? undefined,
      detectedMonth: lp.label.detectedMonth ?? undefined,
      detectedYear: lp.label.detectedYear ?? undefined,
      detectedDate: lp.label.detectedDate ?? undefined,
      confidence: lp.label.confidence,
      needsReview: lp.label.needsReview,
    })),
  });
}
