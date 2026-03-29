/**
 * Image OCR Extractor Adapter
 *
 * Uses tesseract.js for OCR on common image formats.
 * Falls back with actionable warnings when OCR fails.
 */

import type { TextExtractorAdapter, ExtractedContent } from "@/types/document";

async function readBlobAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof (file as Blob).arrayBuffer === "function") {
    return (file as Blob).arrayBuffer();
  }
  return new Response(file as Blob).arrayBuffer();
}

function hasImageMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) {
    return false;
  }

  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  return isPng || isJpeg || isGif || isWebp;
}

export const imageOcrExtractor: TextExtractorAdapter = {
  canHandle(file: File): boolean {
    return file.type.startsWith("image/");
  },

  async extract(file: File): Promise<ExtractedContent> {
    let worker: { recognize: (input: Blob) => Promise<{ data: { text?: string; confidence?: number } }>; terminate: () => Promise<unknown> } | null = null;

    const fileBytes = new Uint8Array(await readBlobAsArrayBuffer(file));
    if (!hasImageMagicBytes(fileBytes)) {
      return {
        text: "",
        confidence: 0.1,
        warnings: ["Image appears invalid or unsupported for OCR."],
      };
    }

    try {
      const Tesseract = await import("tesseract.js");
      worker = await Tesseract.createWorker("eng", 1, {
        logger: () => {
          // Intentionally no-op to avoid noisy console logs during extraction/tests.
        },
      });

      const result = await worker.recognize(file);

      const text = result.data.text?.trim() ?? "";
      const confidence = (result.data.confidence ?? 0) / 100;

      return {
        text,
        confidence,
        warnings: text.length > 0 ? undefined : ["OCR completed but no text was detected in the image."],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown OCR error";
      return {
        text: "",
        confidence: 0.15,
        warnings: [
          `OCR failed: ${message}`,
          "Try a higher-resolution image or route to a cloud OCR provider for better accuracy.",
        ],
      };
    } finally {
      if (worker) {
        await worker.terminate();
      }
    }
  },
};
