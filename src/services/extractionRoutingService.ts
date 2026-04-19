import {
  extractionSchemaRegistry,
  getSchemaIdForDocumentType,
  normalizeExtractionDocumentType,
  UNKNOWN_DOCUMENT_TYPE,
  type ExtractionDocumentType,
} from '@/config/extractionSchemas';
import {
  classifyDocument,
  extractDocument,
  parseDocument,
  type ClassifyResult,
  type ExtractResult,
  type ParseResult,
} from '@/services/coreApiClient';

export interface RoutedExtractionResult {
  documentType: ExtractionDocumentType;
  classificationConfidence: number;
  schemaUsed: string;
  extractedData: Record<string, string>;
  rawParseResponse?: ParseResult;
  rawClassificationResponse: ClassifyResult;
  rawExtractionResponse: ExtractResult;
  rawParsedText: string;
  fallbackPathUsed: boolean;
}

interface RoutedExtractionOptions {
  overrideDocumentType?: ExtractionDocumentType;
  classificationConfidenceThreshold?: number;
}

function extractDataMap(fields: Array<{ key: string; value: string; confidence?: number }>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const field of fields) {
    if (!field.key) continue;
    mapped[field.key] = field.value ?? '';
  }
  return mapped;
}

function shouldFallbackToUnknown(
  type: ExtractionDocumentType,
  confidence: number,
  threshold: number,
): boolean {
  if (type === UNKNOWN_DOCUMENT_TYPE) {
    return true;
  }
  return confidence > 0 && confidence < threshold;
}

function getThreshold(): number {
  const value = Number(import.meta.env.VITE_DOC_TYPE_CONFIDENCE_THRESHOLD ?? 0.6);
  if (Number.isNaN(value) || value <= 0 || value >= 1) {
    return 0.6;
  }
  return value;
}

export async function classifyAndExtractBySchema(
  file: File,
  options: RoutedExtractionOptions = {},
): Promise<RoutedExtractionResult> {
  const threshold = options.classificationConfidenceThreshold ?? getThreshold();
  const rawParseResponse = await parseDocument(file);

  const classification = await classifyDocument(file);
  const classifiedType = normalizeExtractionDocumentType(classification.documentType);
  const confidence = classification.confidence ?? 0;

  const fallbackByConfidence = shouldFallbackToUnknown(classifiedType, confidence, threshold);
  const selectedType = options.overrideDocumentType
    ?? (fallbackByConfidence ? UNKNOWN_DOCUMENT_TYPE : classifiedType);

  const schemaUsed = getSchemaIdForDocumentType(selectedType);
  const fallbackPathUsed = selectedType !== classifiedType || fallbackByConfidence;

  console.info('[community-chronicle] document classification result', {
    filename: file.name,
    classifiedType,
    selectedType,
    confidence,
    threshold,
    overrideDocumentType: options.overrideDocumentType,
    fallbackPathUsed,
    classifierSchemaId: extractionSchemaRegistry.classifierSchemaId,
  });

  let rawExtractionResponse: ExtractResult;
  try {
    rawExtractionResponse = await extractDocument(
      file,
      {
        documentType: selectedType,
        schemaId: schemaUsed,
        schemaName: schemaUsed,
      },
    );
  } catch (error) {
    console.error('[community-chronicle] extraction failed', {
      filename: file.name,
      selectedType,
      schemaUsed,
      fallbackPathUsed,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  console.info('[community-chronicle] extraction routed successfully', {
    filename: file.name,
    selectedType,
    schemaUsed,
    extractionStatus: rawExtractionResponse.status,
  });

  return {
    documentType: selectedType,
    classificationConfidence: confidence,
    schemaUsed,
    extractedData: extractDataMap(rawExtractionResponse.fields ?? []),
    rawParseResponse,
    rawClassificationResponse: classification,
    rawExtractionResponse,
    rawParsedText: rawParseResponse.text ?? '',
    fallbackPathUsed,
  };
}
