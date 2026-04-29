import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSearch, Loader2, FileText, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import SearchBar from "@/components/SearchBar";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";
import {
  apiGetDocumentPreview,
  apiSearchDocuments,
  type DocumentPreview,
  type DocumentSearchParams,
  type DocumentSearchResultItem,
} from "@/services/apiDocuments";
import { usePageSearch, usePacketSearch } from "@/hooks/usePageFirstIntake";
import { PAGE_FIRST_INTAKE_ENABLED } from "@/lib/featureFlags";
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

  // Page-first search (only active when flag is enabled)
  const pageFirstQ = q.trim();
  const { data: pageSearchData, isLoading: pageSearchLoading } = usePageSearch(
    { q: pageFirstQ, type: type.trim(), person: person.trim(), organization: organization.trim(), limit: PAGE_SIZE },
    PAGE_FIRST_INTAKE_ENABLED && pageFirstQ.length > 0,
  );
  const { data: packetSearchData, isLoading: packetSearchLoading } = usePacketSearch(
    { q: pageFirstQ, type: type.trim(), person: person.trim(), organization: organization.trim(), limit: PAGE_SIZE },
    PAGE_FIRST_INTAKE_ENABLED && pageFirstQ.length > 0,
  );

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

  const sharedFilters = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-border p-4 bg-card">
      <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags (comma separated)" />
      <Input value={type} onChange={(event) => setType(event.target.value)} placeholder="Type" />
      <Input value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Person" />
      <Input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="Organization" />
      <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
      <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
    </div>
  );

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

        {/* When page-first is enabled show tabbed search; otherwise show legacy inline */}
        {PAGE_FIRST_INTAKE_ENABLED ? (
          <Tabs defaultValue="documents">
            <TabsList>
              <TabsTrigger value="documents" className="font-body gap-1">
                <FileSearch className="h-3.5 w-3.5" />
                Documents
                {total > 0 && <Badge variant="secondary" className="ml-1 font-body text-xs">{total}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="pages" className="font-body gap-1">
                <FileText className="h-3.5 w-3.5" />
                Pages
                {(pageSearchData?.total ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 font-body text-xs">{pageSearchData!.total}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="packets" className="font-body gap-1">
                <Layers className="h-3.5 w-3.5" />
                Packets
                {(packetSearchData?.total ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 font-body text-xs">{packetSearchData!.total}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Documents tab ── */}
            <TabsContent value="documents" className="space-y-4 mt-4">
              {sharedFilters}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{total} result{total !== 1 ? "s" : ""}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => pageTo(offset - PAGE_SIZE)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={!canNext} onClick={() => pageTo(offset + PAGE_SIZE)}>Next</Button>
                </div>
              </div>
              {isLoading && <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />Loading…</div>}
              {isError && <div className="py-8 px-4 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive">{error instanceof Error ? error.message : "Search failed."}</div>}
              {!isLoading && !isError && results.length === 0 && (
                <div className="py-16 text-center text-muted-foreground"><FileSearch className="h-10 w-10 mx-auto mb-3" />No matches.</div>
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
                        <Button size="sm" onClick={() => openPreview(item)} disabled={previewLoadingId === item.id}>
                          {previewLoadingId === item.id ? "Loading..." : "Preview"}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Pages tab ── */}
            <TabsContent value="pages" className="space-y-4 mt-4">
              {sharedFilters}
              {pageSearchLoading && <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />Loading pages…</div>}
              {!pageSearchLoading && (pageSearchData?.pages ?? []).length === 0 && (
                <div className="py-16 text-center text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3" />{pageFirstQ ? "No page-level matches." : "Enter a search term above."}</div>
              )}
              {!pageSearchLoading && (pageSearchData?.pages ?? []).length > 0 && (
                <div className="space-y-3">
                  {pageSearchData!.pages.map((page) => (
                    <div key={page.id} className="rounded-xl border border-border bg-card p-4 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-body">p.{page.pageNumber}</Badge>
                          {page.detectedDocType && <Badge variant="secondary" className="text-xs font-body">{page.detectedDocType}</Badge>}
                          {page.needsReview && <Badge variant="outline" className="text-xs text-orange-700 border-orange-300 font-body">Review</Badge>}
                        </div>
                        <Link
                          to={`/documents/page-first/review/${page.originalUploadId}`}
                          className="font-body text-xs text-primary hover:underline flex-shrink-0"
                        >
                          Open review →
                        </Link>
                      </div>
                      {(page.detectedCompanyOrOrg || page.detectedPersonName) && (
                        <p className="font-body text-xs text-muted-foreground">
                          {[page.detectedCompanyOrOrg, page.detectedPersonName].filter(Boolean).join(" · ")}
                          {page.detectedYear && ` · ${page.detectedYear}`}
                        </p>
                      )}
                      {page.pageText && (
                        <p className="font-body text-sm text-foreground line-clamp-2">{page.pageText}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Packets tab ── */}
            <TabsContent value="packets" className="space-y-4 mt-4">
              {sharedFilters}
              {packetSearchLoading && <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />Loading packets…</div>}
              {!packetSearchLoading && (packetSearchData?.packets ?? []).length === 0 && (
                <div className="py-16 text-center text-muted-foreground"><Layers className="h-10 w-10 mx-auto mb-3" />{pageFirstQ ? "No packet matches." : "Enter a search term above."}</div>
              )}
              {!packetSearchLoading && (packetSearchData?.packets ?? []).length > 0 && (
                <div className="space-y-3">
                  {packetSearchData!.packets.map((packet) => (
                    <div key={packet.id} className="rounded-xl border border-border bg-card p-4 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-body text-base font-semibold">{packet.title}</h2>
                          <div className="flex items-center gap-2 mt-0.5">
                            {packet.packetType && <Badge variant="outline" className="text-xs font-body">{packet.packetType}</Badge>}
                            <Badge
                              variant="outline"
                              className={`text-xs font-body ${
                                packet.status === "approved" ? "text-green-700 border-green-300" :
                                packet.status === "rejected" ? "text-red-700 border-red-300" : ""
                              }`}
                            >
                              {packet.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-body">
                              {(packet.pages ?? []).length} page{(packet.pages ?? []).length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        {packet.originalUploadId && (
                          <Link
                            to={`/documents/page-first/review/${packet.originalUploadId}`}
                            className="font-body text-xs text-primary hover:underline flex-shrink-0"
                          >
                            Open review →
                          </Link>
                        )}
                      </div>
                      {(packet.primaryCompanyOrOrg || packet.primaryPersonName) && (
                        <p className="font-body text-xs text-muted-foreground">
                          {[packet.primaryCompanyOrOrg, packet.primaryPersonName].filter(Boolean).join(" · ")}
                          {packet.detectedYear && ` · ${packet.detectedYear}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          /* ── Legacy search (flag off) ── */
          <>
            {sharedFilters}

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{total} result{total !== 1 ? "s" : ""}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => pageTo(offset - PAGE_SIZE)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={!canNext} onClick={() => pageTo(offset + PAGE_SIZE)}>Next</Button>
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
          </>
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
