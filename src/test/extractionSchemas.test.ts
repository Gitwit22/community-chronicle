import { describe, expect, it } from 'vitest';
import {
  EXTRACTION_DOCUMENT_TYPES,
  getClassificationCategories,
  getSchemaIdForDocumentType,
  normalizeExtractionDocumentType,
} from '@/config/extractionSchemas';

describe('extractionSchemas registry', () => {
  it('returns a schema ID for each known document type', () => {
    EXTRACTION_DOCUMENT_TYPES.forEach((documentType) => {
      const schemaId = getSchemaIdForDocumentType(documentType);
      expect(schemaId).toBeTruthy();
      expect(schemaId.startsWith('cfg-')).toBe(true);
    });
  });

  it('normalizes unknown types to unknown_document', () => {
    expect(normalizeExtractionDocumentType('totally_new_type')).toBe('unknown_document');
    expect(normalizeExtractionDocumentType(undefined)).toBe('unknown_document');
  });

  it('exposes known classification categories', () => {
    const categories = getClassificationCategories();
    expect(categories).toContain('vendor_invoice');
    expect(categories).toContain('unknown_document');
  });
});
