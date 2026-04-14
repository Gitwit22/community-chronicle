import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Database,
  Eye,
  EyeOff,
  FolderArchive,
  FolderCog,
  FolderOpen,
  HardDrive,
  Network,
  Save,
  Server,
  Shield,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchStorageCapabilities,
  fetchStorageSettings,
  saveStorageSettings,
  testStorageConnection,
} from "@/services/apiStorageSettings";
import type {
  DestinationSettings,
  IntegrationSettings,
  PathStrategy,
  PostProcessingRules,
  ProcessingRulesSettings,
  R2EnvCapabilities,
  RetentionPolicy,
  StorageProvider,
} from "@/types/storageSettings";

const providerMeta: Record<StorageProvider, { label: string; icon: typeof HardDrive; description: string }> = {
  local: {
    label: "Local",
    icon: HardDrive,
    description: "Best for single-machine deployments and fast write access.",
  },
  network: {
    label: "Network Share",
    icon: Network,
    description: "Store on UNC/mounted paths for team-shared access.",
  },
  r2_env: {
    label: "Cloudflare R2 (from environment)",
    icon: Cloud,
    description: "Uses server-managed bucket and credentials from backend environment variables.",
  },
  r2_manual: {
    label: "Cloudflare R2 (manual custom)",
    icon: Cloud,
    description: "Use custom bucket endpoint and credentials entered in this form.",
  },
};

const postProcessingOptions = [
  { key: "keepOriginalOnly", label: "Keep original only" },
  { key: "keepProcessedText", label: "Keep processed text too" },
  { key: "keepGeneratedReport", label: "Keep generated report too" },
  { key: "saveMetadataOnly", label: "Save metadata record only" },
  { key: "moveToArchive", label: "Move to archive folder after processing" },
  { key: "copySecondaryBackup", label: "Copy to secondary backup destination" },
] as const;

type PostProcessingKey = (typeof postProcessingOptions)[number]["key"];

const getDefaultDestination = (
  provider: StorageProvider,
  enabled: boolean,
  useAsFinalArchive: boolean,
  r2Env?: R2EnvCapabilities,
): DestinationSettings => {
  const envManaged = provider === "r2_env";
  return {
  provider,
  enabled,
  saveProcessedDocs: false,
  useAsFinalArchive,
  localPath: "",
  localCreateSubfolders: true,
  networkPath: "",
  networkUsername: "",
  networkPassword: "",
  networkReconnectInstructions: "",
  r2BucketName: envManaged ? (r2Env?.bucketName ?? "") : "",
  r2Endpoint: envManaged ? (r2Env?.endpoint ?? "") : "",
  r2AccessKey: "",
  r2SecretKey: "",
  r2PublicUrl: envManaged ? (r2Env?.publicUrl ?? "") : "",
  r2Prefix: envManaged ? (r2Env?.defaultPrefix ?? "") : "",
  envManaged,
};
};

function normalizeDestinationForCapabilities(
  destination: DestinationSettings,
  r2Env: R2EnvCapabilities | null,
): DestinationSettings {
  if (destination.provider !== "r2_env") {
    return {
      ...destination,
      envManaged: false,
    };
  }

  return {
    ...destination,
    envManaged: true,
    r2BucketName: r2Env?.bucketName ?? "",
    r2Endpoint: r2Env?.endpoint ?? "",
    r2PublicUrl: r2Env?.publicUrl ?? "",
    r2Prefix: destination.r2Prefix || r2Env?.defaultPrefix || "",
    r2AccessKey: "",
    r2SecretKey: "",
  };
}

const StorageSettingsPanel = () => {
  const [settingsTab, setSettingsTab] = useState("storage");
  const [r2EnvCapabilities, setR2EnvCapabilities] = useState<R2EnvCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [finalArchive, setFinalArchive] = useState<DestinationSettings>(
    getDefaultDestination("local", true, true),
  );
  const [processingStorage, setProcessingStorage] = useState<DestinationSettings>(
    getDefaultDestination("network", false, false),
  );
  const [postProcessingRules, setPostProcessingRules] = useState<PostProcessingRules>({
    keepOriginalOnly: false,
    keepProcessedText: true,
    keepGeneratedReport: true,
    saveMetadataOnly: false,
    moveToArchive: true,
    copySecondaryBackup: false,
  });

  const [finalArchiveDirHandle, setFinalArchiveDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [processingDirHandle, setProcessingDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const [pathStrategy, setPathStrategy] = useState<PathStrategy>({
    byYear: true,
    bySource: false,
    byDocType: true,
    byTopic: true,
    customNamingPattern: "{{year}}/{{docType}}/{{topic}}/{{filename}}",
    basePathPrefix: "/",
  });

  const [processingRules, setProcessingRules] = useState<ProcessingRulesSettings>({
    parserProvider: "none",
    ocrEnabled: false,
    classificationEnabled: false,
    keywordGenerationEnabled: false,
    tagGenerationEnabled: false,
    confidenceThresholdAutoApprove: 90,
    confidenceThresholdReviewRequired: 60,
    fallbackBehavior: "manual_review",
    moveOriginalsToArchiveAfterProcessing: false,
  });

  const [retentionPolicy, setRetentionPolicy] = useState<RetentionPolicy>({
    defaultRetentionPeriod: "forever",
    expiredDocAction: "archive",
    keepOriginals: true,
    keepDerivatives: true,
    legalHoldEnabled: false,
  });

  const [integrations, setIntegrations] = useState<IntegrationSettings>({
    llamaCloudEnabled: false,
    llamaCloudApiKey: "",
  });
  const [apiKeyEditing, setApiKeyEditing] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const destinationPathExample = useMemo(() => {
    const segments: string[] = [];
    const currentYear = String(new Date().getFullYear());

    if (pathStrategy.byYear) segments.push(currentYear);
    if (pathStrategy.bySource) segments.push("ImportPortal");
    if (pathStrategy.byDocType) segments.push("Reports");
    if (pathStrategy.byTopic) segments.push("CivilRights");

    const base = pathStrategy.basePathPrefix.trim() || "/";
    const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
    const generated = `${normalizedBase}/${segments.join("/")}/filename.pdf`;
    return generated.replaceAll("//", "/");
  }, [pathStrategy]);

  const providerLabel = (provider: StorageProvider) => providerMeta[provider].label;

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const payload = await fetchStorageSettings();
        setR2EnvCapabilities(payload.capabilities.r2Env);
        setFinalArchive(normalizeDestinationForCapabilities(payload.settings.finalArchive, payload.capabilities.r2Env));
        setProcessingStorage(
          normalizeDestinationForCapabilities(payload.settings.processingStorage, payload.capabilities.r2Env),
        );
        setPostProcessingRules(payload.settings.postProcessingRules);
        setPathStrategy(payload.settings.pathStrategy);
        if (payload.settings.processingRules) setProcessingRules(payload.settings.processingRules);
        if (payload.settings.retentionPolicy) setRetentionPolicy(payload.settings.retentionPolicy);
        if (payload.settings.integrations) {
          const loaded = payload.settings.integrations;
          setIntegrations(loaded);
          // Don't pre-fill the editing input with the stored key
          setApiKeyInput("");
          setApiKeyEditing(false);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load storage settings";
        toast.error(message);
        try {
          const capabilities = await fetchStorageCapabilities();
          setR2EnvCapabilities(capabilities.r2Env);
        } catch {
          setR2EnvCapabilities(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const pickDirectory = async (destinationType: "final" | "processing", setDestination: React.Dispatch<React.SetStateAction<DestinationSettings>>) => {
    if (!('showDirectoryPicker' in window)) {
      toast.error("Folder picker is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      if (destinationType === "final") {
        setFinalArchiveDirHandle(handle);
      } else {
        setProcessingDirHandle(handle);
      }
      setDestination((prev) => ({ ...prev, localPath: handle.name }));
      toast.success(`Folder selected: ${handle.name}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("Failed to select folder.");
    }
  };

  const testConnection = async (destination: "final" | "processing") => {
    const target = destination === "final" ? finalArchive : processingStorage;
    const targetLabel = destination === "final" ? "Final archive" : "Processing storage";

    if (target.provider === "local" && !target.localPath.trim()) {
      toast.error("Base folder path is required before testing write access.");
      return;
    }
    if (target.provider === "network" && !target.networkPath.trim()) {
      toast.error("UNC or mounted path is required before read/write test.");
      return;
    }
    if (target.provider === "r2_manual" && (!target.r2BucketName.trim() || !target.r2Endpoint.trim())) {
      toast.error("Bucket name and endpoint are required before testing R2 connection.");
      return;
    }

    if (target.provider === "r2_env" && !r2EnvCapabilities?.available) {
      toast.error("Cloudflare R2 environment configuration is not available on the backend.");
      return;
    }

    // For local provider: use the File System Access API handle to perform a real write test
    if (target.provider === "local") {
      const handle = destination === "final" ? finalArchiveDirHandle : processingDirHandle;
      if (!handle) {
        toast.error("Please use the Browse button to select a folder first so we can verify write access.");
        return;
      }
      try {
        const testFileName = `.community-chronicle-write-test-${Date.now()}.tmp`;
        const fileHandle = await handle.getFileHandle(testFileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write("Community Chronicle write test — safe to delete.");
        await writable.close();
        // Clean up the test file
        await handle.removeEntry(testFileName);
        toast.success(`${targetLabel} write test succeeded — folder is writable.`);
      } catch {
        toast.error(`${targetLabel} write test failed — check folder permissions.`);
      }
      return;
    }

    if (target.provider === "r2_manual" || target.provider === "r2_env") {
      try {
        setIsTesting(true);
        const result = await testStorageConnection(target);
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "R2 connection test failed.";
        toast.error(message);
      } finally {
        setIsTesting(false);
      }
      return;
    }

    const actionLabel = target.provider === "network" ? "read/write test" : "connection test";
    toast.success(`${targetLabel} ${providerLabel(target.provider)} ${actionLabel} succeeded.`);
  };

  const saveSettings = async () => {
    if (
      (finalArchive.provider === "r2_env" || processingStorage.provider === "r2_env") &&
      !r2EnvCapabilities?.available
    ) {
      toast.error("Cannot save env-backed R2 selection because backend env configuration is unavailable.");
      return;
    }

    try {
      setIsSaving(true);
      // Only update the stored API key if the user actively typed a new one
      const resolvedIntegrations: IntegrationSettings = apiKeyEditing && apiKeyInput.trim()
        ? { ...integrations, llamaCloudApiKey: apiKeyInput.trim() }
        : integrations;

      const payload = await saveStorageSettings({
        finalArchive,
        processingStorage,
        postProcessingRules,
        pathStrategy,
        processingRules,
        retentionPolicy,
        integrations: resolvedIntegrations,
      });

      setR2EnvCapabilities(payload.capabilities.r2Env);
      setFinalArchive(normalizeDestinationForCapabilities(payload.settings.finalArchive, payload.capabilities.r2Env));
      setProcessingStorage(
        normalizeDestinationForCapabilities(payload.settings.processingStorage, payload.capabilities.r2Env),
      );
      setPostProcessingRules(payload.settings.postProcessingRules);
      setPathStrategy(payload.settings.pathStrategy);
      if (payload.settings.processingRules) setProcessingRules(payload.settings.processingRules);
      if (payload.settings.retentionPolicy) setRetentionPolicy(payload.settings.retentionPolicy);
      if (payload.settings.integrations) {
        setIntegrations(payload.settings.integrations);
        setApiKeyInput("");
        setApiKeyEditing(false);
      }

      toast.success("Settings saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save storage settings.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRule = (ruleKey: PostProcessingKey, checked: boolean) => {
    setPostProcessingRules((prev) => ({
      ...prev,
      [ruleKey]: checked,
    }));
  };

  const renderProviderFields = (
    destination: DestinationSettings,
    setDestination: React.Dispatch<React.SetStateAction<DestinationSettings>>,
    destinationType: "final" | "processing",
  ) => {
    if (destination.provider === "local") {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${destinationType}-local-path`}>Base folder path</Label>
            <div className="flex gap-2">
              <Input
                id={`${destinationType}-local-path`}
                value={destination.localPath}
                onChange={(event) =>
                  setDestination((prev) => ({
                    ...prev,
                    localPath: event.target.value,
                  }))
                }
                placeholder="D:/community-chronicle/archive"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => pickDirectory(destinationType, setDestination)}
                className="gap-2 shrink-0"
              >
                <FolderOpen className="h-4 w-4" />
                Browse
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Create subfolders automatically</p>
              <p className="text-xs text-muted-foreground">Create missing year/source/type folders as needed.</p>
            </div>
            <Switch
              checked={destination.localCreateSubfolders}
              onCheckedChange={(checked) =>
                setDestination((prev) => ({
                  ...prev,
                  localCreateSubfolders: checked,
                }))
              }
            />
          </div>
        </div>
      );
    }

    if (destination.provider === "network") {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${destinationType}-network-path`}>UNC path or mounted path</Label>
            <Input
              id={`${destinationType}-network-path`}
              value={destination.networkPath}
              onChange={(event) =>
                setDestination((prev) => ({
                  ...prev,
                  networkPath: event.target.value,
                }))
              }
              placeholder="\\\\server\\share\\community-chronicle"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${destinationType}-network-user`}>Username (optional)</Label>
              <Input
                id={`${destinationType}-network-user`}
                value={destination.networkUsername}
                onChange={(event) =>
                  setDestination((prev) => ({
                    ...prev,
                    networkUsername: event.target.value,
                  }))
                }
                placeholder="domain\\svc_archive"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${destinationType}-network-password`}>Password (optional)</Label>
              <Input
                id={`${destinationType}-network-password`}
                type="password"
                value={destination.networkPassword}
                onChange={(event) =>
                  setDestination((prev) => ({
                    ...prev,
                    networkPassword: event.target.value,
                  }))
                }
                placeholder="********"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${destinationType}-network-reconnect`}>Reconnect instructions (optional)</Label>
            <Textarea
              id={`${destinationType}-network-reconnect`}
              value={destination.networkReconnectInstructions}
              onChange={(event) =>
                setDestination((prev) => ({
                  ...prev,
                  networkReconnectInstructions: event.target.value,
                }))
              }
              placeholder="Map drive Z: on startup and reconnect after VPN sessions."
              rows={3}
            />
          </div>
        </div>
      );
    }

    if (destination.provider === "r2_env") {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">Environment-managed connection</p>
            <p className="text-xs text-muted-foreground mt-1">
              Bucket and credentials are sourced from server environment variables and are not saved from this form.
            </p>
            {!r2EnvCapabilities?.available && (
              <p className="text-xs text-destructive mt-2">
                This option is unavailable because backend R2 environment variables are not fully configured.
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Bucket name (env)</Label>
              <Input readOnly value={r2EnvCapabilities?.bucketName || "Not configured"} />
            </div>
            <div className="space-y-2">
              <Label>Endpoint (env)</Label>
              <Input readOnly value={r2EnvCapabilities?.endpoint || "Not configured"} />
            </div>
            <div className="space-y-2">
              <Label>Public/base URL (env)</Label>
              <Input readOnly value={r2EnvCapabilities?.publicUrl || "Not set"} />
            </div>
            <div className="space-y-2">
              <Label>Default prefix (env)</Label>
              <Input readOnly value={r2EnvCapabilities?.defaultPrefix || "None"} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${destinationType}-r2-prefix-override`}>Prefix/folder path override (optional)</Label>
            <Input
              id={`${destinationType}-r2-prefix-override`}
              value={destination.r2Prefix}
              onChange={(event) =>
                setDestination((prev) => ({
                  ...prev,
                  r2Prefix: event.target.value,
                }))
              }
              placeholder="archives/approved"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${destinationType}-r2-bucket`}>Bucket name</Label>
            <Input
              id={`${destinationType}-r2-bucket`}
              value={destination.r2BucketName}
              onChange={(event) =>
                setDestination((prev) => ({
                  ...prev,
                  r2BucketName: event.target.value,
                }))
              }
              placeholder="my-bucket"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${destinationType}-r2-endpoint`}>Endpoint</Label>
            <Input
              id={`${destinationType}-r2-endpoint`}
              value={destination.r2Endpoint}
              onChange={(event) =>
                setDestination((prev) => ({
                  ...prev,
                  r2Endpoint: event.target.value,
                }))
              }
              placeholder="https://abc123.r2.cloudflarestorage.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${destinationType}-r2-access`}>Access key</Label>
            <Input
              id={`${destinationType}-r2-access`}
              value={destination.r2AccessKey}
              onChange={(event) =>
                setDestination((prev) => ({
                  ...prev,
                  r2AccessKey: event.target.value,
                }))
              }
              placeholder="Manual access key"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${destinationType}-r2-secret`}>Secret key</Label>
            <Input
              id={`${destinationType}-r2-secret`}
              type="password"
              value={destination.r2SecretKey}
              onChange={(event) =>
                setDestination((prev) => ({
                  ...prev,
                  r2SecretKey: event.target.value,
                }))
              }
              placeholder="Manual secret key"
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${destinationType}-r2-public-url`}>Public/base URL (optional)</Label>
            <Input
              id={`${destinationType}-r2-public-url`}
              value={destination.r2PublicUrl}
              onChange={(event) =>
                setDestination((prev) => ({
                  ...prev,
                  r2PublicUrl: event.target.value,
                }))
              }
              placeholder="https://assets.example.org"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${destinationType}-r2-prefix`}>Prefix/folder path</Label>
            <Input
              id={`${destinationType}-r2-prefix`}
              value={destination.r2Prefix}
              onChange={(event) =>
                setDestination((prev) => ({
                  ...prev,
                  r2Prefix: event.target.value,
                }))
              }
              placeholder="archives/approved"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderDestinationCard = (
    title: string,
    description: string,
    destination: DestinationSettings,
    setDestination: React.Dispatch<React.SetStateAction<DestinationSettings>>,
    destinationType: "final" | "processing",
  ) => {
    const ActiveIcon = providerMeta[destination.provider].icon;
    const isFinal = destinationType === "final";

    const providerOrder: StorageProvider[] = ["local", "network", "r2_env", "r2_manual"];

    return (
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="font-display text-xl">{title}</CardTitle>
              <CardDescription className="font-body text-sm mt-1">{description}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={destination.enabled ? "default" : "secondary"}>
                {destination.enabled ? "Active destination" : "Disabled"}
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <ActiveIcon className="h-3.5 w-3.5" />
                {providerMeta[destination.provider].label}
              </Badge>
            </div>
          </div>

          {!isFinal && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Enable optional processing storage</p>
                <p className="text-xs text-muted-foreground">
                  Use a temporary holding location for OCR/parsing output before final approval.
                </p>
              </div>
              <Switch
                checked={destination.enabled}
                onCheckedChange={(checked) =>
                  setDestination((prev) => ({
                    ...prev,
                    enabled: checked,
                  }))
                }
              />
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {(destination.enabled || isFinal) && (
            <>
              <div className="space-y-3">
                <Label className="font-medium">Default storage destination</Label>
                <div className="grid gap-3 md:grid-cols-3">
                  {providerOrder.map((provider) => {
                    const ProviderIcon = providerMeta[provider].icon;
                    const selected = destination.provider === provider;
                    const disabled = provider === "r2_env" && !r2EnvCapabilities?.available;

                    return (
                      <button
                        key={provider}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          !disabled &&
                          setDestination((prev) => ({
                            ...prev,
                            provider,
                            envManaged: provider === "r2_env",
                            ...(provider === "r2_env"
                              ? {
                                  r2BucketName: r2EnvCapabilities?.bucketName || "",
                                  r2Endpoint: r2EnvCapabilities?.endpoint || "",
                                  r2PublicUrl: r2EnvCapabilities?.publicUrl || "",
                                  r2Prefix: prev.r2Prefix || r2EnvCapabilities?.defaultPrefix || "",
                                  r2AccessKey: "",
                                  r2SecretKey: "",
                                }
                              : {}),
                          }))
                        }
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                        title={
                          disabled
                            ? "Backend environment config for Cloudflare R2 is not available."
                            : undefined
                        }
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <ProviderIcon className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">{providerMeta[provider].label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{providerMeta[provider].description}</p>
                        {provider === "r2_env" && !r2EnvCapabilities?.available && (
                          <p className="text-[11px] text-destructive mt-2">
                            Unavailable: backend env variables are not fully configured.
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold text-foreground">Connection setup</h4>
                {renderProviderFields(destination, setDestination, destinationType)}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testConnection(destinationType)}
                    className="gap-2"
                    disabled={isTesting}
                  >
                    <Server className="h-4 w-4" />
                    {destination.provider === "local"
                      ? "Test write"
                      : destination.provider === "network"
                        ? "Read/write test"
                        : "Test connection"}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Save processed docs to this destination</p>
                    <p className="text-xs text-muted-foreground">Store OCR text/report outputs here.</p>
                  </div>
                  <Switch
                    checked={destination.saveProcessedDocs}
                    onCheckedChange={(checked) =>
                      setDestination((prev) => ({
                        ...prev,
                        saveProcessedDocs: checked,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Use as final archive</p>
                    <p className="text-xs text-muted-foreground">Approved docs are retained permanently.</p>
                  </div>
                  <Switch
                    checked={destination.useAsFinalArchive}
                    onCheckedChange={(checked) =>
                      setDestination((prev) => ({
                        ...prev,
                        useAsFinalArchive: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Loading storage settings...</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Settings</CardTitle>
          <CardDescription className="font-body">
            Configure storage, processing behavior, retention defaults, and integrations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={settingsTab} onValueChange={setSettingsTab}>
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="storage" className="font-body">Storage</TabsTrigger>
              <TabsTrigger value="processing" className="font-body">Processing Rules</TabsTrigger>
              <TabsTrigger value="retention" className="font-body">Document Retention</TabsTrigger>
              <TabsTrigger value="integrations" className="font-body">Integrations</TabsTrigger>
            </TabsList>

            <TabsContent value="storage" className="mt-6 space-y-6">
              <div className="rounded-lg border bg-card p-4 md:p-5">
                <h4 className="font-semibold text-foreground mb-3">Storage flow</h4>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">Upload</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">Process</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">Review / Approve</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge>Save to Final Storage</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  This split avoids mixing temporary OCR artifacts with approved archive records.
                </p>
              </div>

              {renderDestinationCard(
                "Final Archive Storage",
                "Primary destination where approved documents live permanently.",
                finalArchive,
                setFinalArchive,
                "final",
              )}

              {renderDestinationCard(
                "Processing Storage",
                "Optional temporary holding area during OCR/parsing and quality checks.",
                processingStorage,
                setProcessingStorage,
                "processing",
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-xl">Folder/path strategy</CardTitle>
                  <CardDescription className="font-body text-sm">
                    Decide how final storage paths are generated.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <Label htmlFor="path-by-year" className="cursor-pointer">Organize by year</Label>
                      <Switch
                        id="path-by-year"
                        checked={pathStrategy.byYear}
                        onCheckedChange={(checked) =>
                          setPathStrategy((prev) => ({
                            ...prev,
                            byYear: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <Label htmlFor="path-by-source" className="cursor-pointer">Organize by source</Label>
                      <Switch
                        id="path-by-source"
                        checked={pathStrategy.bySource}
                        onCheckedChange={(checked) =>
                          setPathStrategy((prev) => ({
                            ...prev,
                            bySource: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <Label htmlFor="path-by-type" className="cursor-pointer">Organize by document type</Label>
                      <Switch
                        id="path-by-type"
                        checked={pathStrategy.byDocType}
                        onCheckedChange={(checked) =>
                          setPathStrategy((prev) => ({
                            ...prev,
                            byDocType: checked,
                          }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <Label htmlFor="path-by-topic" className="cursor-pointer">Organize by topic</Label>
                      <Switch
                        id="path-by-topic"
                        checked={pathStrategy.byTopic}
                        onCheckedChange={(checked) =>
                          setPathStrategy((prev) => ({
                            ...prev,
                            byTopic: checked,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="base-prefix">Base path/prefix</Label>
                      <Input
                        id="base-prefix"
                        value={pathStrategy.basePathPrefix}
                        onChange={(event) =>
                          setPathStrategy((prev) => ({
                            ...prev,
                            basePathPrefix: event.target.value,
                          }))
                        }
                        placeholder="/archive"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="path-preset">Quick naming preset</Label>
                      <Select
                        value={pathStrategy.customNamingPattern}
                        onValueChange={(value) =>
                          setPathStrategy((prev) => ({
                            ...prev,
                            customNamingPattern: value,
                          }))
                        }
                      >
                        <SelectTrigger id="path-preset">
                          <SelectValue placeholder="Select naming pattern" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="{{year}}/{{docType}}/{{topic}}/{{filename}}">
                            Year / Type / Topic / Filename
                          </SelectItem>
                          <SelectItem value="{{source}}/{{year}}/{{filename}}">
                            Source / Year / Filename
                          </SelectItem>
                          <SelectItem value="{{docType}}/{{topic}}/{{filename}}">
                            Type / Topic / Filename
                          </SelectItem>
                          <SelectItem value="{{year}}/{{source}}/{{docType}}/{{filename}}">
                            Year / Source / Type / Filename
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="custom-naming-pattern">Custom naming pattern</Label>
                    <Input
                      id="custom-naming-pattern"
                      value={pathStrategy.customNamingPattern}
                      onChange={(event) =>
                        setPathStrategy((prev) => ({
                          ...prev,
                          customNamingPattern: event.target.value,
                        }))
                      }
                      placeholder="{{year}}/{{docType}}/{{topic}}/{{filename}}"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available tokens: {"{{year}}"}, {"{{source}}"}, {"{{docType}}"}, {"{{topic}}"}, {"{{filename}}"}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Example path</p>
                    <p className="font-mono text-sm text-foreground">{destinationPathExample}</p>
                    <p className="text-xs text-muted-foreground mt-2">Sample: /2026/Reports/CivilRights/filename.pdf</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="processing" className="mt-6 space-y-6">
              {/* Parser & Extraction */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-xl">Parser &amp; Extraction</CardTitle>
                  <CardDescription className="font-body text-sm">
                    Choose how documents are parsed and what data is extracted during ingestion.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-3">
                    <Label className="font-medium">Parser provider</Label>
                    <div className="grid gap-3 md:grid-cols-3">
                      {(
                        [
                          { value: "none", label: "No parsing", description: "Store originals only — no text extraction or OCR." },
                          { value: "local", label: "Local parser", description: "Use the built-in server-side parser (PDF text extraction)." },
                          { value: "llama_cloud", label: "Llama Cloud", description: "Send documents to Llama Cloud for advanced AI parsing and OCR." },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setProcessingRules((prev) => ({ ...prev, parserProvider: opt.value }))}
                          className={`rounded-lg border p-3 text-left transition-colors ${
                            processingRules.parserProvider === opt.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground mb-1">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">OCR</p>
                        <p className="text-xs text-muted-foreground">Extract text from scanned images and PDFs.</p>
                      </div>
                      <Switch
                        checked={processingRules.ocrEnabled}
                        onCheckedChange={(checked) =>
                          setProcessingRules((prev) => ({ ...prev, ocrEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Classification</p>
                        <p className="text-xs text-muted-foreground">Auto-classify document type and topic on ingest.</p>
                      </div>
                      <Switch
                        checked={processingRules.classificationEnabled}
                        onCheckedChange={(checked) =>
                          setProcessingRules((prev) => ({ ...prev, classificationEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Keyword generation</p>
                        <p className="text-xs text-muted-foreground">Generate searchable keywords from document content.</p>
                      </div>
                      <Switch
                        checked={processingRules.keywordGenerationEnabled}
                        onCheckedChange={(checked) =>
                          setProcessingRules((prev) => ({ ...prev, keywordGenerationEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">Tag generation</p>
                        <p className="text-xs text-muted-foreground">Auto-suggest content tags for review.</p>
                      </div>
                      <Switch
                        checked={processingRules.tagGenerationEnabled}
                        onCheckedChange={(checked) =>
                          setProcessingRules((prev) => ({ ...prev, tagGenerationEnabled: checked }))
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quality thresholds */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-xl">Quality &amp; Review Thresholds</CardTitle>
                  <CardDescription className="font-body text-sm">
                    Control when documents are auto-approved vs. routed to manual review.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="threshold-auto-approve">Auto-approve threshold (%)</Label>
                      <Input
                        id="threshold-auto-approve"
                        type="number"
                        min={0}
                        max={100}
                        value={processingRules.confidenceThresholdAutoApprove}
                        onChange={(e) =>
                          setProcessingRules((prev) => ({
                            ...prev,
                            confidenceThresholdAutoApprove: Math.min(100, Math.max(0, Number(e.target.value))),
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Documents scoring at or above this confidence are approved automatically.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="threshold-review">Review-required threshold (%)</Label>
                      <Input
                        id="threshold-review"
                        type="number"
                        min={0}
                        max={100}
                        value={processingRules.confidenceThresholdReviewRequired}
                        onChange={(e) =>
                          setProcessingRules((prev) => ({
                            ...prev,
                            confidenceThresholdReviewRequired: Math.min(100, Math.max(0, Number(e.target.value))),
                          }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Documents scoring between this and the auto-approve threshold go to manual review.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Scores below the review threshold trigger the fallback behavior below.
                  </div>

                  <div className="space-y-3">
                    <Label className="font-medium">Fallback behavior (low confidence)</Label>
                    <div className="grid gap-3 md:grid-cols-3">
                      {(
                        [
                          { value: "manual_review", label: "Manual review", description: "Route to review queue — no automatic action." },
                          { value: "keep_original", label: "Keep original", description: "Store the original file without processing output." },
                          { value: "reject", label: "Reject", description: "Mark as failed and skip archiving." },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setProcessingRules((prev) => ({ ...prev, fallbackBehavior: opt.value }))}
                          className={`rounded-lg border p-3 text-left transition-colors ${
                            processingRules.fallbackBehavior === opt.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground mb-1">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Post-processing artifacts */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-xl">Post-processing Artifacts</CardTitle>
                  <CardDescription className="font-body text-sm">
                    Control which output files are retained after OCR/parsing completes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {postProcessingOptions.map((option) => (
                    <div key={option.key} className="flex items-center justify-between rounded-lg border p-3">
                      <Label htmlFor={`proc-${option.key}`} className="text-sm font-medium cursor-pointer">
                        {option.label}
                      </Label>
                      <Checkbox
                        id={`proc-${option.key}`}
                        checked={postProcessingRules[option.key]}
                        onCheckedChange={(checked) => toggleRule(option.key, checked === true)}
                      />
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Move originals to archive after processing</p>
                      <p className="text-xs text-muted-foreground">
                        After OCR/parsing succeeds, move the source file from processing storage to final archive.
                      </p>
                    </div>
                    <Switch
                      checked={processingRules.moveOriginalsToArchiveAfterProcessing}
                      onCheckedChange={(checked) =>
                        setProcessingRules((prev) => ({ ...prev, moveOriginalsToArchiveAfterProcessing: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="retention" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-xl">Default Retention Period</CardTitle>
                  <CardDescription className="font-body text-sm">
                    How long approved documents are kept before the expiration policy applies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="retention-period">Retention period</Label>
                    <Select
                      value={retentionPolicy.defaultRetentionPeriod}
                      onValueChange={(value) =>
                        setRetentionPolicy((prev) => ({
                          ...prev,
                          defaultRetentionPeriod: value as RetentionPolicy["defaultRetentionPeriod"],
                        }))
                      }
                    >
                      <SelectTrigger id="retention-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1_year">1 year</SelectItem>
                        <SelectItem value="2_years">2 years</SelectItem>
                        <SelectItem value="5_years">5 years</SelectItem>
                        <SelectItem value="7_years">7 years</SelectItem>
                        <SelectItem value="10_years">10 years</SelectItem>
                        <SelectItem value="forever">Forever (no expiration)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="font-medium">When a document expires</Label>
                    <div className="grid gap-3 md:grid-cols-3">
                      {(
                        [
                          { value: "archive", label: "Move to archive", description: "Retain in cold storage but remove from active view." },
                          { value: "delete", label: "Permanently delete", description: "Remove the document and all derivatives permanently." },
                          { value: "notify_only", label: "Notify only", description: "Flag for review — no automatic action taken." },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setRetentionPolicy((prev) => ({ ...prev, expiredDocAction: opt.value }))
                          }
                          className={`rounded-lg border p-3 text-left transition-colors ${
                            retentionPolicy.expiredDocAction === opt.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <p className="text-sm font-semibold text-foreground mb-1">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-xl">File Retention Options</CardTitle>
                  <CardDescription className="font-body text-sm">
                    Choose which file versions are subject to the retention policy.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Keep original files</p>
                      <p className="text-xs text-muted-foreground">
                        Retain the source documents uploaded by contributors.
                      </p>
                    </div>
                    <Switch
                      checked={retentionPolicy.keepOriginals}
                      onCheckedChange={(checked) =>
                        setRetentionPolicy((prev) => ({ ...prev, keepOriginals: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Keep derivative files</p>
                      <p className="text-xs text-muted-foreground">
                        Retain OCR text, generated reports, and other processing outputs.
                      </p>
                    </div>
                    <Switch
                      checked={retentionPolicy.keepDerivatives}
                      onCheckedChange={(checked) =>
                        setRetentionPolicy((prev) => ({ ...prev, keepDerivatives: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <CardTitle className="font-display text-xl">Legal Hold</CardTitle>
                  </div>
                  <CardDescription className="font-body text-sm">
                    Prevent any document from being deleted or archived regardless of retention rules.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-900/40 p-3">
                    <div>
                      <p className="text-sm font-medium">Enable legal hold</p>
                      <p className="text-xs text-muted-foreground">
                        When enabled, no document in this archive will be deleted or moved to cold storage
                        until legal hold is removed.
                      </p>
                    </div>
                    <Switch
                      checked={retentionPolicy.legalHoldEnabled}
                      onCheckedChange={(checked) =>
                        setRetentionPolicy((prev) => ({ ...prev, legalHoldEnabled: checked }))
                      }
                    />
                  </div>
                  {retentionPolicy.legalHoldEnabled && (
                    <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 font-medium">
                      Legal hold is active — expiration and delete policies are suspended.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="integrations" className="mt-6 space-y-6">
              {/* Llama Cloud */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-xl">Llama Cloud</CardTitle>
                      <CardDescription className="font-body text-sm mt-1">
                        AI-powered document parsing, OCR, and extraction via the Llama Cloud API.
                      </CardDescription>
                    </div>
                    <Badge
                      variant={integrations.llamaCloudEnabled ? "default" : "secondary"}
                      className="gap-1.5"
                    >
                      {integrations.llamaCloudEnabled ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" /> Enabled
                        </>
                      ) : (
                        "Disabled"
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Enable Llama Cloud integration</p>
                      <p className="text-xs text-muted-foreground">
                        Required for AI parsing in Processing Rules. Needs a valid API key below.
                      </p>
                    </div>
                    <Switch
                      checked={integrations.llamaCloudEnabled}
                      onCheckedChange={(checked) =>
                        setIntegrations((prev) => ({ ...prev, llamaCloudEnabled: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">API Key</Label>
                      {integrations.llamaCloudApiKey && !apiKeyEditing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setApiKeyEditing(true);
                            setApiKeyInput("");
                          }}
                        >
                          Change key
                        </Button>
                      )}
                    </div>

                    {integrations.llamaCloudApiKey && !apiKeyEditing ? (
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                        <span className="flex-1 font-mono text-sm text-foreground">
                          {apiKeyVisible
                            ? integrations.llamaCloudApiKey
                            : `${"•".repeat(Math.max(0, integrations.llamaCloudApiKey.length - 4))}${integrations.llamaCloudApiKey.slice(-4)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setApiKeyVisible((v) => !v)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={apiKeyVisible ? "Hide key" : "Show key"}
                        >
                          {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <Badge variant="outline" className="gap-1 shrink-0">
                          <CheckCircle2 className="h-3 w-3 text-green-500" /> Configured
                        </Badge>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          type="password"
                          placeholder="llx-••••••••••••••••••••••••••••••"
                          value={apiKeyInput}
                          onChange={(e) => {
                            setApiKeyInput(e.target.value);
                            setApiKeyEditing(true);
                          }}
                          autoComplete="off"
                        />
                        <p className="text-xs text-muted-foreground">
                          Your API key is stored server-side and never exposed in full after saving.
                        </p>
                        {apiKeyEditing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setApiKeyEditing(false);
                              setApiKeyInput("");
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}

                    {integrations.llamaCloudEnabled && !integrations.llamaCloudApiKey && !apiKeyEditing && (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Integration is enabled but no API key is configured. Parsing jobs will fail.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Future integrations */}
              <Card className="opacity-60">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="font-display text-xl text-muted-foreground">Secondary Backup Destination</CardTitle>
                  </div>
                  <CardDescription className="font-body text-sm">
                    Mirror approved documents to an additional storage provider. Coming soon.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">Not yet available</Badge>
                </CardContent>
              </Card>

              <Card className="opacity-60">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="font-display text-xl text-muted-foreground">Compliance Logging</CardTitle>
                  </div>
                  <CardDescription className="font-body text-sm">
                    Send audit events to an external compliance or SIEM endpoint. Coming soon.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline">Not yet available</Badge>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" onClick={() => testConnection("final")} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Test active destination
        </Button>
        <Button onClick={saveSettings} className="gap-2" disabled={isSaving}>
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save settings"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FolderCog className="h-4 w-4 text-primary" />
              Temporary processing storage
            </div>
            <p className="text-xs text-muted-foreground">
              Keeps in-progress files, OCR artifacts, and retry snapshots separate from approved records.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FolderArchive className="h-4 w-4 text-primary" />
              Approved final archive
            </div>
            <p className="text-xs text-muted-foreground">
              Stores curated records after review and approval, with predictable folder strategy.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4 text-primary" />
              Metadata and audit trail
            </div>
            <p className="text-xs text-muted-foreground">
              Tracks document lineage for failed docs, multi-destination backups, and future compliance checks.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StorageSettingsPanel;
