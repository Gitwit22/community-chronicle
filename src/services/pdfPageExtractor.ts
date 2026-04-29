/**
 * Per-page PDF text extractor for the page-first intake flow.
 *
 * Returns one entry per page with extracted text so the caller can label
 * each page independently before submitting to the page-first upload endpoint.
 *
 * Non-PDF files (images, plain text) return a single page entry.
 */

export interface ExtractedPage {
  pageNumber: number;
  pageText: string;
}

const MIN_CHARS_FOR_TEXT = 20;

/**
 * Extract per-page text from a PDF using pdf.js.
 * Falls back to an empty-text page if extraction fails.
 */
async function extractPdfPages(file: File): Promise<ExtractedPage[]> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const uint8 = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({
      data: uint8,
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    const pages: ExtractedPage[] = [];

    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ")
        .trim();
      pages.push({ pageNumber: pageNo, pageText });
    }

    return pages;
  } catch {
    return [{ pageNumber: 1, pageText: "" }];
  }
}

/**
 * Extract per-page text from a plain-text file.
 * Returns a single page with the full file text.
 */
async function extractTextFilePage(file: File): Promise<ExtractedPage[]> {
  try {
    const text = await file.text();
    return [{ pageNumber: 1, pageText: text.slice(0, 8000) }];
  } catch {
    return [{ pageNumber: 1, pageText: "" }];
  }
}

/**
 * Extract pages from any supported file type.
 * PDFs → one entry per page.
 * Text/CSV/HTML/Markdown → single page.
 * Images → single page with empty text (needs OCR, handled server-side).
 */
export async function extractFilePages(file: File): Promise<ExtractedPage[]> {
  if (file.type === "application/pdf") {
    const pages = await extractPdfPages(file);
    // If pdf.js returned no usable text on any page, still keep the structure
    return pages.length > 0 ? pages : [{ pageNumber: 1, pageText: "" }];
  }

  const textTypes = new Set([
    "text/plain",
    "text/csv",
    "text/html",
    "text/markdown",
  ]);
  if (textTypes.has(file.type) || file.name.endsWith(".md")) {
    return extractTextFilePage(file);
  }

  // Images and everything else: single page, empty text
  return [{ pageNumber: 1, pageText: "" }];
}

/**
 * Return the page count for a file without retaining text.
 * Useful for displaying "X pages" in the upload UI.
 */
export async function getFilePageCount(file: File): Promise<number> {
  if (file.type !== "application/pdf") return 1;
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const uint8 = new Uint8Array(await file.arrayBuffer());
    const task = pdfjs.getDocument({
      data: uint8,
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    const pdf = await task.promise;
    return pdf.numPages;
  } catch {
    return 1;
  }
}

export function hasUsableText(pages: ExtractedPage[]): boolean {
  return pages.some((p) => p.pageText.length >= MIN_CHARS_FOR_TEXT);
}
