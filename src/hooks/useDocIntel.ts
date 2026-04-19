import { useMutation } from "@tanstack/react-query";
import {
  classifyDocument,
  extractDocument,
  isCoreApiConfigured,
  parseDocument,
  processDocument,
  type ClassifyResult,
  type ExtractRequestOptions,
  type ExtractResult,
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
    ExtractResult,
    Error,
    { file: File; options: ExtractRequestOptions; onProgress?: (progress: number) => void }
  >({
    mutationFn: ({ file, options, onProgress }) => extractDocument(file, options, onProgress),
  });
}

export function useProcessDocument() {
  return useMutation<
    ProcessResult,
    Error,
    {
      file: File;
      options?: { parse?: boolean; classify?: boolean; extract?: boolean; extractOptions?: ExtractRequestOptions };
    }
  >({
    mutationFn: ({ file, options }) => processDocument(file, options),
  });
}
