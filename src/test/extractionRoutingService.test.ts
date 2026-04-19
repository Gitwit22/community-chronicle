import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/coreApiClient', () => ({
  parseDocument: vi.fn(),
  classifyDocument: vi.fn(),
  extractDocument: vi.fn(),
}));

import { classifyAndExtractBySchema } from '@/services/extractionRoutingService';
import { getSchemaIdForDocumentType } from '@/config/extractionSchemas';
import { classifyDocument, extractDocument, parseDocument } from '@/services/coreApiClient';

const parseMock = vi.mocked(parseDocument);
const classifyMock = vi.mocked(classifyDocument);
const extractMock = vi.mocked(extractDocument);

describe('extractionRoutingService', () => {
  const file = new File(['hello'], 'invoice.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    vi.clearAllMocks();

    parseMock.mockResolvedValue({
      provider: 'mock',
      status: 'complete',
      text: 'parsed text',
      markdown: 'parsed markdown',
    });

    classifyMock.mockResolvedValue({
      provider: 'mock',
      status: 'complete',
      documentType: 'vendor_invoice',
      confidence: 0.92,
      reasoning: 'invoice keywords',
    });

    extractMock.mockResolvedValue({
      status: 'complete',
      fields: [
        { key: 'invoice_number', value: 'INV-123' },
        { key: 'amount', value: '$100.00' },
      ],
    });
  });

  it('routes extraction using the classified document type schema', async () => {
    const result = await classifyAndExtractBySchema(file);

    expect(result.documentType).toBe('vendor_invoice');
    expect(result.schemaUsed).toBe(getSchemaIdForDocumentType('vendor_invoice'));
    expect(result.extractedData.invoice_number).toBe('INV-123');
    expect(extractMock).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        documentType: 'vendor_invoice',
        schemaId: getSchemaIdForDocumentType('vendor_invoice'),
      }),
    );
  });

  it('falls back to unknown_document when confidence is low', async () => {
    classifyMock.mockResolvedValueOnce({
      provider: 'mock',
      status: 'complete',
      documentType: 'vendor_invoice',
      confidence: 0.2,
      reasoning: 'low confidence',
    });

    const result = await classifyAndExtractBySchema(file, { classificationConfidenceThreshold: 0.6 });

    expect(result.documentType).toBe('unknown_document');
    expect(result.fallbackPathUsed).toBe(true);
    expect(result.schemaUsed).toBe(getSchemaIdForDocumentType('unknown_document'));
  });

  it('supports manual override for document type', async () => {
    const result = await classifyAndExtractBySchema(file, {
      overrideDocumentType: 'check_image',
    });

    expect(result.documentType).toBe('check_image');
    expect(result.schemaUsed).toBe(getSchemaIdForDocumentType('check_image'));
    expect(result.fallbackPathUsed).toBe(true);
  });
});
