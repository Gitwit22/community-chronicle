/**
 * Fallback Extractor Adapter
 *
 * Handles any file type not covered by other adapters.
 * Attempts to read as text; returns a placeholder if that fails.
 */

import type { TextExtractorAdapter, ExtractedContent } from "@/types/document";

export const fallbackExtractor: TextExtractorAdapter = {
  canHandle(): boolean {
    return true;
  },

  async extract(file: File): Promise<ExtractedContent> {
    // Try reading as raw text
    try {
      const text = await file.text();
      return {
        text,
        confidence: 0.5,
        warnings: ["Extracted using fallback text reader. Results may be unreliable."],
      };
    } catch {
      return {
        text: `[Could not extract text from ${file.name} (${file.type})]`,
        confidence: 0,
        warnings: [`Failed to extract text from ${file.name}`],
      };
    }
  },
};
