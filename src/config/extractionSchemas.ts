export const EXTRACTION_DOCUMENT_TYPES = [
  'voucher_cover',
  'vendor_invoice',
  'deposit_summary',
  'check_image',
  'donor_acknowledgment_letter',
  'donation_reply_card',
  'bank_statement_or_reconciliation',
  'payment_confirmation',
  'unknown_document',
] as const;

export type ExtractionDocumentType = (typeof EXTRACTION_DOCUMENT_TYPES)[number];

export const UNKNOWN_DOCUMENT_TYPE: ExtractionDocumentType = 'unknown_document';

export interface ExtractionSchemaRegistry {
  classifierSchemaId: string;
  byType: Record<ExtractionDocumentType, string>;
}

function envValue(key: string, fallback: string): string {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

export const extractionSchemaRegistry: ExtractionSchemaRegistry = {
  classifierSchemaId: envValue(
    'VITE_LLAMA_SCHEMA_DOCUMENT_CLASSIFIER_RESULT',
    'cfg-ab0cav8xvylvzr2j3vjnzev19l3u',
  ),
  byType: {
    unknown_document: envValue(
      'VITE_LLAMA_SCHEMA_UNKNOWN_DOCUMENT',
      'cfg-b6cwlmqsr1zfwyrw70wewn04soi4',
    ),
    payment_confirmation: envValue(
      'VITE_LLAMA_SCHEMA_PAYMENT_CONFIRMATION',
      'cfg-j70yj4opktqiuewnxek9pyuwmf22',
    ),
    bank_statement_or_reconciliation: envValue(
      'VITE_LLAMA_SCHEMA_BANK_STATEMENT_OR_RECONCILIATION',
      'cfg-14oyv05pm1i3d2cqhf1oh0rd9mf9',
    ),
    donation_reply_card: envValue(
      'VITE_LLAMA_SCHEMA_DONATION_REPLY_CARD',
      'cfg-xueeuio3b6xkvnuhegun4fkguuyf',
    ),
    donor_acknowledgment_letter: envValue(
      'VITE_LLAMA_SCHEMA_DONOR_ACKNOWLEDGMENT_LETTER',
      'cfg-sd3gvogfwzvdrtgk4fnluicyilh7',
    ),
    check_image: envValue(
      'VITE_LLAMA_SCHEMA_CHECK_IMAGE',
      'cfg-0qwu94bdh2tcep1881vxoak1bp6j',
    ),
    deposit_summary: envValue(
      'VITE_LLAMA_SCHEMA_DEPOSIT_SUMMARY',
      'cfg-7t1wktm7e8g2jiaeh8zagg5ile14',
    ),
    vendor_invoice: envValue(
      'VITE_LLAMA_SCHEMA_VENDOR_INVOICE',
      'cfg-dcf0u301vj67g7a5gb5lcs7oi4o9',
    ),
    voucher_cover: envValue(
      'VITE_LLAMA_SCHEMA_VOUCHER_COVER',
      'cfg-qh8kw3krirnfjpe7cnmtwndcuh8q',
    ),
  },
};

export function isKnownExtractionDocumentType(value: string | undefined | null): value is ExtractionDocumentType {
  if (!value) return false;
  return (EXTRACTION_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function normalizeExtractionDocumentType(value: string | undefined | null): ExtractionDocumentType {
  const normalized = (value ?? '').toLowerCase().trim();
  if (isKnownExtractionDocumentType(normalized)) {
    return normalized;
  }
  return UNKNOWN_DOCUMENT_TYPE;
}

export function getSchemaIdForDocumentType(documentType: ExtractionDocumentType): string {
  return extractionSchemaRegistry.byType[documentType] ?? extractionSchemaRegistry.byType.unknown_document;
}

export function getClassificationCategories(): ExtractionDocumentType[] {
  return [...EXTRACTION_DOCUMENT_TYPES];
}
