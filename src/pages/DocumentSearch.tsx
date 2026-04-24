import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SearchBar from "@/components/SearchBar";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";
import {
  apiGetDocumentPreview,
  apiSearchDocuments,
  type DocumentPreview,
  type DocumentSearchParams,
  type DocumentSearchResultItem,
} from "@/services/apiDocuments";
import { toast } from "sonner";

const PAGE_SIZE = 20;

function readParams(searchParams: URLSearchParams): DocumentSearchParams {
  const tags = searchParams.get("tags")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    q: searchParams.get("q") ?? "",
    tags,
    type: searchParams.get("type") ?? "",
    person: searchParams.get("person") ?? "",
    organization: searchParams.get("organization") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    limit: Number(searchParams.get("limit") ?? PAGE_SIZE),
    offset: Number(searchParams.get("offset") ?? 0),
  };
}

function writeParams(params: DocumentSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.tags && params.tags.length > 0) next.set("tags", params.tags.join(","));
  if (params.type) next.set("type", params.type);
  if (params.person) next.set("person", params.person);
  if (params.organization) next.set("organization", params.organization);
  if (params.dateFrom) next.set("dateFrom", params.dateFrom);
  if (params.dateTo) next.set("dateTo", params.dateTo);
  next.set("limit", String(params.limit ?? PAGE_SIZE));
  next.set("offset", String(params.offset ?? 0));
  return next;
}

export default function DocumentSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentParams = useMemo(() => readParams(searchParams), [searchParams]);

  const [q, setQ] = useState(currentParams.q ?? "");
  const [tags, setTags] = useState((currentParams.tags ?? []).join(", "));
  const [type, setType] = useState(currentParams.type ?? "");
  const [person, setPerson] = useState(currentParams.person ?? "");
  const [organization, setOrganization] = useState(currentParams.organization ?? "");
  const [dateFrom, setDateFrom] = useState(currentParams.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(currentParams.dateTo ?? "");

  const [selectedPreview, setSelectedPreview] = useState<DocumentPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  useEffect(() => {
    setQ(currentParams.q ?? "");
    setTags((currentParams.tags ?? []).join(", "));
    setType(currentParams.type ?? "");
    setPerson(currentParams.person ?? "");
    setOrganization(currentParams.organization ?? "");
    setDateFrom(currentParams.dateFrom ?? "");
    setDateTo(currentParams.dateTo ?? "");
  }, [currentParams.dateFrom, currentParams.dateTo, currentParams.organization, currentParams.person, currentParams.q, currentParams.tags, currentParams.type]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["documents", "api-search", currentParams],
    queryFn: () => apiSearchDocuments(currentParams),
  });

  const results = data?.results ?? [];
  const total = data?.total ?? 0;
  const offset = currentParams.offset ?? 0;
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  const runSearch = () => {
    const nextParams: DocumentSearchParams = {
      q: q.trim(),
      tags: tags
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      type: type.trim(),
      person: person.trim(),
      organization: organization.trim(),
      dateFrom,
      dateTo,
      limit: PAGE_SIZE,
      offset: 0,
    };

    setSearchParams(writeParams(nextParams));
  };

  const pageTo = (nextOffset: number) => {
    setSearchParams(
      writeParams({
        ...currentParams,
        limit: PAGE_SIZE,
        offset: Math.max(nextOffset, 0),
      }),
    );
  };

  const openPreview = async (item: DocumentSearchResultItem) => {
    setPreviewLoadingId(item.id);
    try {
      const preview = await apiGetDocumentPreview(item.id);
      setSelectedPreview(preview);
      setPreviewOpen(true);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to load preview.";
      toast.error(message);
    } finally {
      setPreviewLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Button variant="outline" onClick={() => navigate("/")}> 
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
          <h1 className="font-display text-2xl font-bold">Document Search</h1>
        </div>

        <SearchBar value={q} onChange={setQ} onSearch={runSearch} onClear={() => {
          setQ("");
          setTags("");
          setType("");
          setPerson("");
          setOrganization("");
          setDateFrom("");
          setDateTo("");
          setSearchParams(writeParams({ limit: PAGE_SIZE, offset: 0 }));
        }} clearLabel="Clear" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-border p-4 bg-card">
          <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags (comma separated)" />
          <Input value={type} onChange={(event) => setType(event.target.value)} placeholder="Type" />
          <Input value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Person" />
          <Input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Organization" />
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} result{total !== 1 ? "s" : ""}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => pageTo(offset - PAGE_SIZE)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!canNext} onClick={() => pageTo(offset + PAGE_SIZE)}>
              Next
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
            Loading search results...
          </div>
        )}

        {isError && (
          <div className="py-8 px-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive">
            {error instanceof Error ? error.message : "Search failed."}
          </div>
        )}

        {!isLoading && !isError && results.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <FileSearch className="h-10 w-10 mx-auto mb-3" />
            No matches found for the current filters.
          </div>
        )}

        {!isLoading && !isError && results.length > 0 && (
          <div className="space-y-3">
            {results.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-body text-base font-semibold">{item.title}</h2>
                    <p className="text-xs text-muted-foreground">{item.filename ?? "No filename"}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openPreview(item)}
                    disabled={previewLoadingId === item.id}
                  >
                    {previewLoadingId === item.id ? "Loading..." : "Preview"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{item.snippet}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <DocumentPreviewModal
        preview={selectedPreview}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}
