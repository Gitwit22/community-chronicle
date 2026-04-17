/**
 * Core Document Intelligence API Client
 *
 * Provides direct HTTP access to the Core Document Intelligence Service deployed
 * separately from nxt-lvl-api. Used for real-time preview during document upload
 * and for standalone extraction/classification operations.
 */

import {
  globalFrontendDocIntelMetrics,
  type FrontendMetricsOperation,
} from "@/lib/docIntelMetrics";

export type DocumentType =
  | "irs_notice"
  | "bank_receipt"
  | "invoice"
  | "meeting_minutes"
  | "board_governance"
  | "grant_document"
  | "contract"
  | "newsletter"
  | "general_report"
  | "uncategorized";

export interface ParseResult {
  provider: string;
  status: "complete" | "failed" | "skipped";
  text: string;
  markdown: string;
  confidence?: number;
  pages?: { page_number: number; text: string }[];
  tables?: unknown[];
  entities?: unknown[];
}

export interface ClassifyResult {
  provider: string;
  status: "complete" | "failed" | "skipped";
  documentType: DocumentType;
  confidence: number | null;
  reasoning: string | null;
  labels?: unknown;
}

export interface ProcessResult {
  parse?: ParseResult;
  classify?: ClassifyResult;
  extract?: {
    status: string;
    fields: Array<{ key: string; value: string; confidence?: number }>;
  };
}

const DEFAULT_CATEGORIES: DocumentType[] = [
  "irs_notice",
  "bank_receipt",
  "invoice",
  "meeting_minutes",
  "board_governance",
  "grant_document",
  "contract",
  "newsletter",
  "general_report",
  "uncategorized",
];

function getConfig() {
  const baseUrl = import.meta.env.VITE_DOC_INTEL_API_URL as string | undefined;
  const token = import.meta.env.VITE_DOC_INTEL_API_TOKEN as string | undefined;
  const timeout = Number(import.meta.env.VITE_DOC_INTEL_TIMEOUT_MS ?? 60000);

  return { baseUrl, token, timeout };
}

export function isCoreApiConfigured(): boolean {
  const { baseUrl, token } = getConfig();
  return Boolean(baseUrl && token);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function classifyWithFallback(file: File): ClassifyResult {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  let documentType: DocumentType = "uncategorized";
  if (name.includes("invoice")) documentType = "invoice";
  else if (name.includes("receipt") || name.includes("bank")) documentType = "bank_receipt";
  else if (name.includes("contract") || name.includes("agreement")) documentType = "contract";
  else if (name.includes("newsletter")) documentType = "newsletter";
  else if (name.includes("minutes")) documentType = "meeting_minutes";
  else if (name.includes("grant")) documentType = "grant_document";
  else if (name.includes("report")) documentType = "general_report";
  else if (name.includes("irs") || name.includes("tax")) documentType = "irs_notice";
  else if (mime.startsWith("image/")) documentType = "general_report";

  return {
    provider: "rule-based-fallback",
    status: "complete",
    documentType,
    confidence: 0.45,
    reasoning: "Fallback classification based on filename and MIME heuristics",
  };
}

function recordMetric(params: {
  operation: FrontendMetricsOperation;
  startedAt: number;
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
  file?: File;
}) {
  globalFrontendDocIntelMetrics.record({
    timestamp: params.startedAt,
    operation: params.operation,
    durationMs: Date.now() - params.startedAt,
    success: params.success,
    statusCode: params.statusCode,
    errorMessage: params.errorMessage,
    fileSize: params.file?.size,
    mimeType: params.file?.type,
  });
}

async function callEndpoint<T>(
  endpoint: string,
  operation: FrontendMetricsOperation,
  file: File,
  additionalFields?: Record<string, string>,
  onProgress?: (progress: number) => void,
): Promise<T> {
  const { baseUrl, token, timeout } = getConfig();

  if (!baseUrl || !token) {
    const error = "Core API is not configured (missing URL or token)";
    recordMetric({ operation, startedAt: Date.now(), success: false, errorMessage: error, file });
    throw new Error(error);
  }

  const startedAt = Date.now();
  const form = new FormData();
  form.append("file", file);

  if (additionalFields) {
    for (const [key, value] of Object.entries(additionalFields)) {
      form.append(key, value);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      const errorMessage = `Core API ${endpoint} failed with ${response.status}: ${text.slice(0, 200)}`;
      recordMetric({
        operation,
        startedAt,
        success: false,
        statusCode: response.status,
        errorMessage,
        file,
      });
      throw new Error(errorMessage);
    }

    if (onProgress) {
      onProgress(100);
    }

    recordMetric({ operation, startedAt, success: true, statusCode: response.status, file });
    return (await response.json()) as T;
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("failed with"))) {
      recordMetric({
        operation,
        startedAt,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        file,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function parseDocument(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<ParseResult> {
  if (!isCoreApiConfigured()) {
    throw new Error("Core API is not configured");
  }

  return callEndpoint<ParseResult>("/parse", "parse", file, undefined, onProgress);
}

export async function classifyDocument(
  file: File,
  categories?: DocumentType[],
  onProgress?: (progress: number) => void,
): Promise<ClassifyResult> {
  if (!isCoreApiConfigured()) {
    const fallback = classifyWithFallback(file);
    recordMetric({
      operation: "classify",
      startedAt: Date.now(),
      success: true,
      statusCode: 200,
      file,
      errorMessage: "Core API not configured; used rule-based fallback",
    });
    return fallback;
  }

  const cats = categories ?? DEFAULT_CATEGORIES;

  try {
    return await callEndpoint<ClassifyResult>(
      "/classify",
      "classify",
      file,
      { categories: JSON.stringify(cats) },
      onProgress,
    );
  } catch {
    const fallback = classifyWithFallback(file);
    recordMetric({
      operation: "classify",
      startedAt: Date.now(),
      success: true,
      statusCode: 200,
      file,
      errorMessage: "Core API classify failed; used rule-based fallback",
    });
    return fallback;
  }
}

export async function extractDocument(
  file: File,
  schema: unknown,
  onProgress?: (progress: number) => void,
): Promise<{ status: string; fields: Array<{ key: string; value: string; confidence?: number }> }> {
  if (!isCoreApiConfigured()) {
    throw new Error("Core API is not configured");
  }

  return callEndpoint(
    "/extract",
    "extract",
    file,
    { schema: JSON.stringify(schema) },
    onProgress,
  );
}

export async function processDocument(
  file: File,
  options: { parse?: boolean; classify?: boolean; extract?: boolean; schema?: unknown } = {
    parse: true,
    classify: true,
  },
): Promise<ProcessResult> {
  const result: ProcessResult = {};

  if (options.parse) {
    result.parse = await parseDocument(file);
  }

  if (options.classify) {
    result.classify = await classifyDocument(file);
  }

  if (options.extract && options.schema) {
    result.extract = await extractDocument(file, options.schema);
  }

  return result;
}

export async function getCapabilities(): Promise<{
  providers: Array<{ provider: string; capabilities: string[]; available: boolean }>;
}> {
  const { baseUrl, token } = getConfig();

  if (!baseUrl || !token) {
    throw new Error("Core API is not configured");
  }

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/capabilities`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch capabilities: ${response.status}`);
  }

  return response.json();
}
