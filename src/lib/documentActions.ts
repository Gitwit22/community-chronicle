import { getAuthHeaders } from "@/lib/tokenStorage";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

function apiOrigin(): string | null {
  if (!API_BASE.startsWith("http://") && !API_BASE.startsWith("https://")) {
    return null;
  }

  try {
    const parsed = new URL(API_BASE);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function resolveDocumentUrl(fileUrl?: string): string | null {
  if (!fileUrl) return null;
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }

  if (fileUrl.startsWith("/")) {
    const origin = apiOrigin();
    return origin ? `${origin}${fileUrl}` : fileUrl;
  }

  return fileUrl;
}

function isProtectedDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return /\/documents\/[^/]+\/download$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

function triggerAnchorDownload(href: string, filename?: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  if (filename) {
    anchor.download = filename;
  }
  anchor.rel = "noopener noreferrer";
  anchor.target = "_blank";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function fetchProtectedDownload(fileUrl: string): Promise<{ redirectedUrl?: string; blob?: Blob } | null> {
  try {
    const response = await fetch(fileUrl, {
      method: "GET",
      headers: getAuthHeaders(),
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        return { redirectedUrl: location };
      }
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return { blob };
  } catch {
    return null;
  }
}

export async function downloadDocument(fileUrl?: string, filename?: string): Promise<boolean> {
  const resolved = resolveDocumentUrl(fileUrl);
  if (!resolved) return false;

  if (!isProtectedDownloadUrl(resolved)) {
    triggerAnchorDownload(resolved, filename);
    return true;
  }

  const result = await fetchProtectedDownload(resolved);
  if (!result) return false;

  if (result.redirectedUrl) {
    triggerAnchorDownload(result.redirectedUrl, filename);
    return true;
  }

  if (!result.blob) return false;

  const objectUrl = URL.createObjectURL(result.blob);
  triggerAnchorDownload(objectUrl, filename);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  return true;
}

export async function openOriginalDocument(fileUrl?: string): Promise<boolean> {
  const resolved = resolveDocumentUrl(fileUrl);
  if (!resolved) return false;

  if (!isProtectedDownloadUrl(resolved)) {
    window.open(resolved, "_blank", "noopener,noreferrer");
    return true;
  }

  const result = await fetchProtectedDownload(resolved);
  if (!result) return false;

  if (result.redirectedUrl) {
    window.open(result.redirectedUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  if (!result.blob) return false;

  const objectUrl = URL.createObjectURL(result.blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  return true;
}
