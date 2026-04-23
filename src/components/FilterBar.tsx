import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, AlertTriangle } from "lucide-react";
import { MONTH_NAMES } from "@/types/document";
import { useDocumentTypes } from "@/hooks/useDocuments";
import { getDocumentTypeLabel } from "@/services/documentTypeClassifier";
import type { ChronicleDocumentType } from "@/types/document";

export interface Filters {
  name: string;
  year: string;
  month: string;
  category: string;
  type: string;
  financialCategory: string;
  financialDocumentType: string;
  intakeSource: string;
  processingStatus: string;
  // Phase 2 lightweight metadata filters
  documentType: string;
  sourceName: string;
  person: string;
  personRole: string;
  company: string;
  reviewRequired: boolean;
}

const PERSON_ROLE_LABELS: Record<string, string> = {
  primary_subject: "Primary Subject",
  sender: "Sender",
  recipient: "Recipient",
  attendee: "Attendee",
  staff_contact: "Staff / Contact",
  unknown_person_mention: "Other Mention",
};

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  years: number[];
}

const INTAKE_SOURCE_LABELS: Record<string, string> = {
  file_upload: "File Upload",
  multi_upload: "Multi Upload",
  drag_drop: "Drag & Drop",
  bulk_folder: "Folder Upload",
  scanner_import: "Scanner",
  email_import: "Email",
  cloud_import: "Cloud",
  manual_entry: "Manual Entry",
  legacy_import: "Legacy Import",
};

const PROCESSING_STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  imported: "Imported",
  queued: "Queued",
  processing: "Processing",
  processed: "Processed",
  failed: "Failed",
  needs_review: "Needs Review",
};

const FilterBar = ({ filters, onChange, years }: FilterBarProps) => {
  const { data: docTypes = [] } = useDocumentTypes();
  const activeTypes = docTypes.filter((t: ChronicleDocumentType) => t.active);

  const hasFilters =
    filters.name || filters.year || filters.month || filters.category || filters.type ||
    filters.financialCategory || filters.financialDocumentType ||
    filters.intakeSource || filters.processingStatus ||
    filters.documentType || filters.sourceName || filters.person ||
    filters.personRole || filters.company || filters.reviewRequired;

  return (
    <div className="space-y-3">
      {/* Row 1: text search inputs */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={filters.name}
          onChange={(e) => onChange({ ...filters, name: e.target.value })}
          placeholder="Title / Author"
          className="w-[180px] bg-card font-body"
        />
        <Input
          value={filters.sourceName}
          onChange={(e) => onChange({ ...filters, sourceName: e.target.value })}
          placeholder="From / Source"
          className="w-[160px] bg-card font-body"
        />
        <Input
          value={filters.person}
          onChange={(e) => onChange({ ...filters, person: e.target.value })}
          placeholder="Person"
          className="w-[140px] bg-card font-body"
        />
        <Select
          value={filters.personRole}
          onValueChange={(v) => onChange({ ...filters, personRole: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[165px] bg-card font-body">
            <SelectValue placeholder="Person Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Person Roles</SelectItem>
            {Object.entries(PERSON_ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={filters.company}
          onChange={(e) => onChange({ ...filters, company: e.target.value })}
          placeholder="Organization"
          className="w-[160px] bg-card font-body"
        />
      </div>

      {/* Row 2: selects + review toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filters.year} onValueChange={(v) => onChange({ ...filters, year: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[130px] bg-card font-body">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.month} onValueChange={(v) => onChange({ ...filters, month: v === "all" ? "" : v })}>
          <SelectTrigger className="w-[140px] bg-card font-body">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Phase 2: document type from registry */}
        <Select
          value={filters.documentType}
          onValueChange={(v) => onChange({ ...filters, documentType: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[190px] bg-card font-body">
            <SelectValue placeholder="Document Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {activeTypes.length > 0
              ? activeTypes.map((dt: ChronicleDocumentType) => (
                  <SelectItem key={dt.key} value={dt.key}>
                    {dt.label}
                    {dt.isUserCreated && (
                      <span className="ml-1 text-muted-foreground text-xs">(custom)</span>
                    )}
                  </SelectItem>
                ))
              : /* Fallback to static labels if registry hasn't loaded */
                Object.entries({
                  invoice: "Invoice",
                  receipt: "Receipt / Acknowledgment",
                  letter: "Letter / Correspondence",
                  form: "Form / Application",
                  sign_in_sheet: "Sign-In Sheet / Roster",
                  business_card: "Business Card",
                  report: "Report / Study",
                  notice: "Notice / Government Document",
                  other_unclassified: "Other (Unclassified)",
                }).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.intakeSource}
          onValueChange={(v) => onChange({ ...filters, intakeSource: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[150px] bg-card font-body">
            <SelectValue placeholder="Intake Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.entries(INTAKE_SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.processingStatus}
          onValueChange={(v) => onChange({ ...filters, processingStatus: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[150px] bg-card font-body">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(PROCESSING_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Needs review toggle */}
        <button
          type="button"
          onClick={() => onChange({ ...filters, reviewRequired: !filters.reviewRequired })}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium font-body transition-colors ${
            filters.reviewRequired
              ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
              : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
          }`}
          aria-pressed={filters.reviewRequired}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Needs Review
        </button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                name: "", year: "", month: "", category: "", type: "",
                financialCategory: "", financialDocumentType: "",
                intakeSource: "", processingStatus: "",
                documentType: "", sourceName: "", person: "", personRole: "", company: "",
                reviewRequired: false,
              })
            }
            className="text-muted-foreground hover:text-foreground font-body"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
