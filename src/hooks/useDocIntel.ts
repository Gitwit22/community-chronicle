import { useMutation } from "@tanstack/react-query";
import {
  classifyDocument,
  extractDocument,
  isCoreApiConfigured,
  parseDocument,
  processDocument,
  type ClassifyResult,
  type ParseResult,
  type ProcessResult,
} from "@/services/coreApiClient";

export function useDocIntelConfig() {
  return {
    isConfigured: isCoreApiConfigured(),
  };
}

export function useParseDocument() {
  return useMutation<ParseResult, Error, { file: File; onProgress?: (progress: number) => void }>({
    mutationFn: ({ file, onProgress }) => parseDocument(file, onProgress),
  });
}

export function useClassifyDocument() {
  return useMutation<ClassifyResult, Error, { file: File; onProgress?: (progress: number) => void }>({
    mutationFn: ({ file, onProgress }) => classifyDocument(file, undefined, onProgress),
  });
}

export function useExtractDocument() {
  return useMutation<
    { status: string; fields: Array<{ key: string; value: string; confidence?: number }> },
    Error,
    { file: File; schema: unknown; onProgress?: (progress: number) => void }
  >({
    mutationFn: ({ file, schema, onProgress }) => extractDocument(file, schema, onProgress),
  });
}

export function useProcessDocument() {
  return useMutation<
    ProcessResult,
    Error,
    {
      file: File;
      options?: { parse?: boolean; classify?: boolean; extract?: boolean; schema?: unknown };
    }
  >({
    mutationFn: ({ file, options }) => processDocument(file, options),
  });
}
