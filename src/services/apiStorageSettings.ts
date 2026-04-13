import { API_BASE } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/tokenStorage";
import type {
  DestinationSettings,
  StorageCapabilitiesResponse,
  StorageConnectionResult,
  StorageSettingsPayload,
  StorageSettingsResponse,
} from "@/types/storageSettings";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as Record<string, unknown>).message)
        : payload && typeof payload === "object" && "error" in payload
          ? String((payload as Record<string, unknown>).error)
          : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function fetchStorageCapabilities(): Promise<StorageCapabilitiesResponse> {
  const response = await fetch(`${API_BASE}/storage/capabilities`, {
    headers: getAuthHeaders(),
  });

  return parseJsonResponse<StorageCapabilitiesResponse>(response);
}

export async function fetchStorageSettings(): Promise<StorageSettingsResponse> {
  const response = await fetch(`${API_BASE}/storage/settings`, {
    headers: getAuthHeaders(),
  });

  return parseJsonResponse<StorageSettingsResponse>(response);
}

export async function saveStorageSettings(
  settings: StorageSettingsPayload,
): Promise<StorageSettingsResponse> {
  const response = await fetch(`${API_BASE}/storage/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(settings),
  });

  return parseJsonResponse<StorageSettingsResponse>(response);
}

export async function testStorageConnection(
  destination: DestinationSettings,
): Promise<StorageConnectionResult> {
  const response = await fetch(`${API_BASE}/storage/test-connection`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ destination }),
  });

  return parseJsonResponse<StorageConnectionResult>(response);
}
