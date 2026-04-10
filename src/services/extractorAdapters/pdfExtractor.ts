/**
 * PDF Extractor Adapter
 *
 * Uses pdf.js to extract page text from PDF files in the browser.
 * For scanned/image-only PDFs where pdf.js yields no usable text, automatically
 * falls back to Tesseract.js OCR — rendering each page to a canvas and running
 * OCR on it at 2× scale for improved accuracy.
 */

import type { TextExtractorAdapter, ExtractedContent } from "@/types/document";

/** Characters-per-page threshold below which we consider the PDF scanned/image-only. */
const OCR_FALLBACK_CHARS_PER_PAGE = 50;

/** Render scale for OCR. 2.0 = 2× pixel density for better Tesseract accuracy. */
const OCR_RENDER_SCALE = 2.0;

/**
 * Render a single pdf.js PDFPageProxy to a PNG Blob.
 * Returns null if the canvas or rendering fails.
 */
async function renderPdfPageToBlob(
  // We accept unknown here and cast below to avoid pulling in pdfjs-dist types
  page: unknown,
): Promise<Blob | null> {
  const p = page as {
    getViewport: (opts: { scale: number }) => { width: number; height: number };
    render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
  };

  const viewport = p.getViewport({ scale: OCR_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  await p.render({ canvasContext: ctx, viewport }).promise;

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

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
      const isScanned = text.length < OCR_FALLBACK_CHARS_PER_PAGE * pdf.numPages;

      // -----------------------------------------------------------------------
      // OCR fallback: scanned / image-only PDF
      // Render each page to a canvas at 2× scale and run Tesseract on the PNG.
      // -----------------------------------------------------------------------
      if (isScanned) {
        try {
          const Tesseract = await import("tesseract.js");
          const worker = await Tesseract.createWorker("eng", 1, {
            logger: () => {
              // Intentionally no-op — suppress progress noise
            },
          });

          const ocrPages: string[] = [];
          try {
            for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
              const page = await pdf.getPage(pageNo);
              const blob = await renderPdfPageToBlob(page);
              if (!blob) {
                ocrPages.push("");
                continue;
              }
              const result = await worker.recognize(blob);
              ocrPages.push(result.data.text?.trim() ?? "");
            }
          } finally {
            await worker.terminate();
          }

          const ocrText = ocrPages.join("\n\n").trim();

          return {
            text: ocrText,
            pages: pdf.numPages,
            confidence: ocrText.length > 0 ? 0.65 : 0.3,
            warnings: ocrText.length > 0
              ? ["PDF appears to be scanned. OCR was applied — review extracted text for accuracy."]
              : ["PDF appears to be scanned but OCR returned no text. Document may need manual transcription."],
          };
        } catch (ocrError) {
          const ocrMessage = ocrError instanceof Error ? ocrError.message : "Unknown OCR error";
          return {
            text: "",
            pages: pdf.numPages,
            confidence: 0.2,
            warnings: [
              "PDF appears to be scanned but OCR failed.",
              `OCR error: ${ocrMessage}`,
              "Try uploading a higher-resolution scan or use a cloud OCR service for better results.",
            ],
          };
        }
      }

      // Normal text-layer PDF
      return {
        text,
        pages: pdf.numPages,
        confidence: text.length > 0 ? 0.88 : 0.45,
        warnings: text.length > 0
          ? undefined
          : ["PDF parsed but no extractable text was found. Document may be scanned."],
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
