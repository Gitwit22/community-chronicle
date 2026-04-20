/**
 * Environment Configuration
 * Centralizes all environment variable loading and provides typed access
 */

const parseBoolean = (value: string | undefined, defaultValue = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
};

export const envConfig = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  },

  // Cores Configuration
  cores: {
    api: {
      url: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
    },
  },

  // Suite URLs
  suite: {
    url: import.meta.env.VITE_SUITE_URL || "http://localhost:3000",
  },

  // Document Intelligence
  docIntel: {
    apiUrl: import.meta.env.VITE_DOC_INTEL_API_URL || "http://localhost:4010",
    apiToken: import.meta.env.VITE_DOC_INTEL_API_TOKEN || "",
    typeConfidenceThreshold: parseFloat(
      import.meta.env.VITE_DOC_TYPE_CONFIDENCE_THRESHOLD || "0.6"
    ),
  },

  // Llama Classification Schemas
  llama: {
    classifierResult: import.meta.env.VITE_LLAMA_SCHEMA_DOCUMENT_CLASSIFIER_RESULT,
    voucherCover: import.meta.env.VITE_LLAMA_SCHEMA_VOUCHER_COVER,
    vendorInvoice: import.meta.env.VITE_LLAMA_SCHEMA_VENDOR_INVOICE,
    depositSummary: import.meta.env.VITE_LLAMA_SCHEMA_DEPOSIT_SUMMARY,
    checkImage: import.meta.env.VITE_LLAMA_SCHEMA_CHECK_IMAGE,
    donorAckLetter: import.meta.env.VITE_LLAMA_SCHEMA_DONOR_ACKNOWLEDGMENT_LETTER,
    donationReplyCard: import.meta.env.VITE_LLAMA_SCHEMA_DONATION_REPLY_CARD,
    bankStatement: import.meta.env.VITE_LLAMA_SCHEMA_BANK_STATEMENT_OR_RECONCILIATION,
    paymentConfirmation: import.meta.env.VITE_LLAMA_SCHEMA_PAYMENT_CONFIRMATION,
    unknownDocument: import.meta.env.VITE_LLAMA_SCHEMA_UNKNOWN_DOCUMENT,
  },
};
