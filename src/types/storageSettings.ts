export type StorageProvider = "local" | "network" | "r2_manual" | "r2_env";

export type DestinationSettings = {
  provider: StorageProvider;
  enabled: boolean;
  saveProcessedDocs: boolean;
  useAsFinalArchive: boolean;
  localPath: string;
  localCreateSubfolders: boolean;
  networkPath: string;
  networkUsername: string;
  networkPassword: string;
  networkReconnectInstructions: string;
  r2BucketName: string;
  r2Endpoint: string;
  r2AccessKey: string;
  r2SecretKey: string;
  r2PublicUrl: string;
  r2Prefix: string;
  envManaged: boolean;
};

export type PostProcessingRules = {
  keepOriginalOnly: boolean;
  keepProcessedText: boolean;
  keepGeneratedReport: boolean;
  saveMetadataOnly: boolean;
  moveToArchive: boolean;
  copySecondaryBackup: boolean;
};

export type PathStrategy = {
  byYear: boolean;
  bySource: boolean;
  byDocType: boolean;
  byTopic: boolean;
  customNamingPattern: string;
  basePathPrefix: string;
};

export type ProcessingRulesSettings = {
  parserProvider: "llama_cloud" | "local" | "none";
  ocrEnabled: boolean;
  classificationEnabled: boolean;
  keywordGenerationEnabled: boolean;
  tagGenerationEnabled: boolean;
  confidenceThresholdAutoApprove: number;
  confidenceThresholdReviewRequired: number;
  fallbackBehavior: "manual_review" | "reject" | "keep_original";
  moveOriginalsToArchiveAfterProcessing: boolean;
};

export type RetentionPolicy = {
  defaultRetentionPeriod: "1_year" | "2_years" | "5_years" | "7_years" | "10_years" | "forever";
  expiredDocAction: "archive" | "delete" | "notify_only";
  keepOriginals: boolean;
  keepDerivatives: boolean;
  legalHoldEnabled: boolean;
};

export type IntegrationSettings = {
  llamaCloudEnabled: boolean;
  llamaCloudApiKey: string;
};

export type StorageSettingsPayload = {
  finalArchive: DestinationSettings;
  processingStorage: DestinationSettings;
  postProcessingRules: PostProcessingRules;
  pathStrategy: PathStrategy;
  processingRules: ProcessingRulesSettings;
  retentionPolicy: RetentionPolicy;
  integrations: IntegrationSettings;
};

export type R2EnvCapabilities = {
  provider: "r2_env";
  available: boolean;
  configuredForActiveBackend: boolean;
  bucketName: string;
  accountId: string;
  endpoint: string;
  publicUrl: string;
  defaultPrefix: string;
  status: "configured" | "not_configured";
  message: string;
};

export type StorageCapabilitiesResponse = {
  r2Env: R2EnvCapabilities;
};

export type StorageSettingsResponse = {
  settings: StorageSettingsPayload;
  capabilities: StorageCapabilitiesResponse;
};

export type StorageConnectionResult = {
  success: boolean;
  message: string;
  key?: string;
  step?: "write" | "read" | "verify" | "delete";
  error?: string;
};
