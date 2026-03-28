/**
 * PDF Extractor Adapter
 *
 * Uses pdf.js to extract page text from PDF files in the browser.
 * Falls back with a warning if parsing fails.
 */

import type { TextExtractorAdapter, ExtractedContent } from "@/types/document";

export const pdfExtractor: TextExtractorAdapter = {
  canHandle(file: File): boolean {
    return file.type === "application/pdf";
  },

  async extract(file: File): Promise<ExtractedContent> {
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const uint8 = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjs.getDocument({
        data: uint8,
        useWorkerFetch: false,
        isEvalSupported: false,
      });
      const pdf = await loadingTask.promise;

      const pageText: string[] = [];

      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        const textItems = content.items
          .map((item) => {
            if ("str" in item) {
              return item.str;
            }
            return "";
          })
          .filter(Boolean);

        pageText.push(textItems.join(" "));
      }

      const text = pageText.join("\n\n").trim();

      return {
        text,
        pages: pdf.numPages,
        confidence: text.length > 0 ? 0.88 : 0.45,
        warnings: text.length > 0 ? undefined : ["PDF parsed but no extractable text was found. Document may be scanned."],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown PDF parse error";
      return {
        text: `[PDF extraction failed for ${file.name}. The file may be scanned/image-only or malformed.]`,
        confidence: 0.2,
        warnings: [
          `Unable to parse PDF: ${message}`,
          "If this is a scanned PDF, route it through OCR extraction.",
        ],
      };
    }
  },
};
