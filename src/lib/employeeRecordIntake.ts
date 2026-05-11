export type EmployeeRecordPreview = {
  personName: string;
  year: number | null;
  date: string | null;
  needsReview: boolean;
};

const GENERIC_NAME_PATTERNS = [
  /^scan\d*$/i,
  /^document\d*$/i,
  /^paperwork\d*$/i,
  /^form\d*$/i,
  /^file\d*$/i,
  /^record\d*$/i,
  /^employeerecord\d*$/i,
  /^backgroundcheck\d*$/i,
];

const TRAILING_DOC_WORDS = [
  "employee record",
  "record",
  "background check",
  "application",
  "paperwork",
  "form",
  "scan",
  "document",
  "copy",
];

const YEAR_TOKEN = /(19\d{2}|20\d{2})/g;
const DATE_TOKEN = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-](?:19\d{2}|20\d{2}))\b/g;

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/[\/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitPath(pathValue: string): string[] {
  return pathValue
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function parseYear(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1900 || parsed > 2099) return null;
  return parsed;
}

function extractYear(text: string): number | null {
  const matches = text.match(YEAR_TOKEN);
  if (!matches || matches.length === 0) return null;
  for (const raw of matches) {
    const year = parseYear(raw);
    if (year !== null) return year;
  }
  return null;
}

function extractDate(text: string): string | null {
  const match = text.match(DATE_TOKEN);
  if (!match || match.length === 0) return null;
  return match[0] ?? null;
}

function removeDateTokens(value: string): string {
  return value.replace(DATE_TOKEN, " ").replace(YEAR_TOKEN, " ");
}

function trimTrailingDocWords(value: string): string {
  let result = value.trim();
  let changed = true;

  while (changed && result.length > 0) {
    changed = false;
    const lowered = result.toLowerCase();
    for (const token of TRAILING_DOC_WORDS) {
      if (lowered.endsWith(token)) {
        result = result.slice(0, result.length - token.length).trim();
        changed = true;
        break;
      }
    }
  }

  return result;
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isGenericName(value: string): boolean {
  const collapsed = value.toLowerCase().replace(/\s+/g, "").trim();
  if (!collapsed) return true;
  return GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(collapsed));
}

function cleanCandidateName(raw: string): string {
  const normalized = normalizeWhitespace(raw);
  const withoutDates = normalizeWhitespace(removeDateTokens(normalized));
  const trimmed = normalizeWhitespace(trimTrailingDocWords(withoutDates));
  if (!trimmed) return "";
  return toTitleCase(trimmed);
}

function detectPathYear(relativePath?: string): number | null {
  if (!relativePath) return null;
  const segments = splitPath(relativePath);
  if (segments.length === 0) return null;

  for (let i = segments.length - 2; i >= 0; i -= 1) {
    const segmentYear = parseYear(segments[i]);
    if (segmentYear !== null) return segmentYear;
    const embeddedYear = extractYear(segments[i]);
    if (embeddedYear !== null) return embeddedYear;
  }

  for (const segment of segments) {
    const embeddedYear = extractYear(segment);
    if (embeddedYear !== null) return embeddedYear;
  }

  return null;
}

function fallbackNameFromPath(relativePath?: string): string {
  if (!relativePath) return "";
  const segments = splitPath(relativePath);
  if (segments.length <= 1) return "";

  const parentSegments = segments.slice(0, -1);
  for (let i = parentSegments.length - 1; i >= 0; i -= 1) {
    const candidate = parentSegments[i];
    if (parseYear(candidate) !== null) continue;
    const cleaned = cleanCandidateName(candidate);
    if (cleaned && !isGenericName(cleaned)) return cleaned;
  }

  return "";
}

export function deriveEmployeeRecordPreview(filename: string, relativePath?: string): EmployeeRecordPreview {
  const fileBase = stripExtension(filename);
  const cleanedFileName = cleanCandidateName(fileBase);
  const fallback = fallbackNameFromPath(relativePath);

  const personName = cleanedFileName && !isGenericName(cleanedFileName)
    ? cleanedFileName
    : fallback || "Needs review";

  const year = extractYear(fileBase) ?? detectPathYear(relativePath);
  const date = extractDate(fileBase) ?? (relativePath ? extractDate(relativePath) : null);

  return {
    personName,
    year,
    date,
    needsReview: personName === "Needs review",
  };
}
