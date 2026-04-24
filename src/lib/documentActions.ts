import { getAuthHeaders } from "@/lib/tokenStorage";
import { API_BASE } from "@/lib/apiBase";

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
  const trimmed = fileUrl.trim();
  if (!trimmed || trimmed === "#" || trimmed.toLowerCase() === "about:blank") {
    return null;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    const origin = apiOrigin();
    return origin ? `${origin}${trimmed}` : trimmed;
  }

  return trimmed;
}

function isPreviewableMimeType(mimeType?: string): boolean {
  if (!mimeType) return true;
  const normalized = mimeType.toLowerCase();
  if (normalized === "application/pdf") return true;
  if (normalized.startsWith("image/")) return true;
  if (normalized.startsWith("text/")) return true;
  if (normalized.includes("json")) return true;
  return false;
}

function filenameSuggestsPreviewableType(filename?: string): boolean {
  if (!filename) return true;
  const normalized = filename.toLowerCase();
  return [".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".txt", ".csv", ".json"].some((ext) =>
    normalized.endsWith(ext),
  );
}

function shouldTryInlinePreview(mimeType?: string, filename?: string): boolean {
  return isPreviewableMimeType(mimeType) && filenameSuggestsPreviewableType(filename);
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

function withDisposition(url: string, disposition: "inline" | "attachment"): string {
  try {
    const parsed = new URL(url, window.location.origin);
    parsed.searchParams.set("disposition", disposition);
    return parsed.toString();
  } catch {
    return url;
  }
}

function toResolveUrl(downloadUrl: string, disposition: "inline" | "attachment"): string {
  try {
    const parsed = new URL(downloadUrl, window.location.origin);
    parsed.pathname = parsed.pathname.replace(/\/download$/, "/resolve");
    parsed.search = "";
    parsed.searchParams.set("disposition", disposition);
    return parsed.toString();
  } catch {
    return downloadUrl;
  }
}

async function resolveProtectedUrl(fileUrl: string, disposition: "inline" | "attachment"): Promise<string | null> {
  try {
    const response = await fetch(toResolveUrl(fileUrl, disposition), {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { url?: string };
    return typeof data.url === "string" ? data.url : null;
  } catch {
    return null;
  }
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

  const signedUrl = await resolveProtectedUrl(resolved, "attachment");
  if (signedUrl) {
    triggerAnchorDownload(signedUrl, filename);
    return true;
  }

  const result = await fetchProtectedDownload(withDisposition(resolved, "attachment"));
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

export async function openOriginalDocument(fileUrl?: string, mimeType?: string, filename?: string): Promise<boolean> {
  const resolved = resolveDocumentUrl(fileUrl);
  if (!resolved) return false;
  if (!shouldTryInlinePreview(mimeType, filename)) return false;

  const popup = window.open("", "_blank", "noopener,noreferrer");

  if (!isProtectedDownloadUrl(resolved)) {
    if (popup) {
      popup.location.href = resolved;
    } else {
      window.open(resolved, "_blank", "noopener,noreferrer");
    }
    return true;
  }

  const signedUrl = await resolveProtectedUrl(resolved, "inline");
  if (signedUrl) {
    if (popup) {
      popup.location.href = signedUrl;
    } else {
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    }
    return true;
  }

  const result = await fetchProtectedDownload(withDisposition(resolved, "inline"));
  if (!result) {
    popup?.close();
    return false;
  }

  if (result.redirectedUrl) {
    if (popup) {
      popup.location.href = result.redirectedUrl;
    } else {
      window.open(result.redirectedUrl, "_blank", "noopener,noreferrer");
    }
    return true;
  }

  if (!result.blob) {
    popup?.close();
    return false;
  }

  if (!isPreviewableMimeType(result.blob.type || mimeType)) {
    popup?.close();
    return false;
  }

  const objectUrl = URL.createObjectURL(result.blob);
  if (popup) {
    popup.location.href = objectUrl;
  } else {
    window.open(objectUrl, "_blank", "noopener,noreferrer");
  }
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  return true;
}
