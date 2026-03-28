/**
 * Office Extractor Adapter
 *
 * Supports text extraction from:
 * - .docx using mammoth
 * - .xlsx/.xls using xlsx
 */

import type { TextExtractorAdapter, ExtractedContent } from "@/types/document";

async function readBlobAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof (file as Blob).arrayBuffer === "function") {
    return (file as Blob).arrayBuffer();
  }
  return new Response(file as Blob).arrayBuffer();
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

function isDocx(file: File): boolean {
  return file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
}

function isSpreadsheet(file: File): boolean {
  const lower = file.name.toLowerCase();
  return file.type === XLSX_MIME || file.type === XLS_MIME || lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

export const officeExtractor: TextExtractorAdapter = {
  canHandle(file: File): boolean {
    return isDocx(file) || isSpreadsheet(file);
  },

  async extract(file: File): Promise<ExtractedContent> {
    if (isDocx(file)) {
      try {
        const mammoth = await import("mammoth/mammoth.browser");
        const arrayBuffer = await readBlobAsArrayBuffer(file);
        const result = await mammoth.extractRawText({ arrayBuffer });

        return {
          text: result.value?.trim() ?? "",
          confidence: result.value?.trim() ? 0.9 : 0.5,
          warnings: result.messages?.length
            ? result.messages.map((m) => m.message)
            : undefined,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown DOCX extraction error";
        return {
          text: `[DOCX extraction failed for ${file.name}]`,
          confidence: 0.2,
          warnings: [
            `Unable to parse DOCX: ${message}`,
          ],
        };
      }
    }

    if (isSpreadsheet(file)) {
      try {
        const xlsxModule = await import("xlsx");
        const XLSX = xlsxModule.default ?? xlsxModule;
        const raw = await readBlobAsArrayBuffer(file);
        const hasBuffer = typeof Buffer !== "undefined";
        const workbook = XLSX.read(hasBuffer ? Buffer.from(raw) : new Uint8Array(raw), {
          type: hasBuffer ? "buffer" : "array",
        });
        const lines: string[] = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) {
            continue;
          }

          const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
          if (csv.length > 0) {
            lines.push(`# Sheet: ${sheetName}`);
            lines.push(csv);
          }
        }

        const text = lines.join("\n\n").trim();
        return {
          text,
          confidence: text.length > 0 ? 0.92 : 0.5,
          warnings: text.length > 0 ? undefined : ["Spreadsheet parsed but contained no extractable text cells."],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown spreadsheet extraction error";
        return {
          text: `[Spreadsheet extraction failed for ${file.name}]`,
          confidence: 0.2,
          warnings: [
            `Unable to parse spreadsheet: ${message}`,
          ],
        };
      }
    }

    return {
      text: "",
      confidence: 0,
      warnings: ["Unsupported Office format for extraction."],
    };
  },
};
