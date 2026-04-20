import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";

interface SearchResult {
  id: string;
  fileName: string;
  title?: string;
  classification?: string;
  status: string;
  confidence?: number;
  fileType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy: {
    displayName: string;
    email: string;
  };
}

interface SearchResponse {
  documents: SearchResult[];
  total: number;
  limit: number;
  offset: number;
  executionMs: number;
}

interface Classification {
  label: string;
  value: string;
  count: number;
}

interface DocumentSearchProps {
  organizationId: string;
  authToken?: string;
}

export function DocumentSearch({ organizationId, authToken }: DocumentSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedClassification, setSelectedClassification] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [offset, setOffset] = useState(0);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setOffset(0);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search results query
  const { data: searchResults, isLoading: isSearching } = useQuery<SearchResponse>({
    queryKey: ["documents/search", organizationId, debouncedQuery, selectedClassification, selectedStatus, offset],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        return { documents: [], total: 0, limit: 20, offset: 0, executionMs: 0 };
      }

      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
      }

      const response = await fetch("/api/documents/search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          q: debouncedQuery,
          organizationId,
          classification: selectedClassification || undefined,
          status: selectedStatus || undefined,
          limit: 20,
          offset,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Search failed: ${response.status}`);
      }

      return response.json();
    },
    enabled: !!debouncedQuery.trim(),
  });

  // Classifications for filter dropdown
  const { data: classifications, isLoading: isLoadingClassifications } = useQuery<Classification[]>({
    queryKey: ["classifications", organizationId],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
      }

      const response = await fetch(`/api/classifications?organizationId=${organizationId}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch classifications");
      }

      return response.json();
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      uploaded: "bg-blue-100 text-blue-800",
      processing: "bg-yellow-100 text-yellow-800",
      classified: "bg-purple-100 text-purple-800",
      reviewed: "bg-green-100 text-green-800",
      archived: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getClassificationColor = (confidence?: number) => {
    if (!confidence) return "bg-gray-100";
    if (confidence >= 0.8) return "bg-green-100 text-green-800";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="w-full space-y-6">
      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Search Documents</CardTitle>
          <CardDescription>Find documents by title, classification, or content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Classification</label>
              <Select value={selectedClassification} onValueChange={setSelectedClassification}>
                <SelectTrigger disabled={isLoadingClassifications}>
                  <SelectValue placeholder="All classifications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All classifications</SelectItem>
                  {classifications?.map((cls) => (
                    <SelectItem key={cls.value} value={cls.value || "unclassified"}>
                      {cls.label} ({cls.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="classified">Classified</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Results</label>
              <div className="text-sm text-gray-600 py-2">
                {isSearching ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </span>
                ) : searchResults ? (
                  <span>{searchResults.total} results found in {searchResults.executionMs}ms</span>
                ) : (
                  <span>Enter search query</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && searchResults.documents.length > 0 && (
        <div className="space-y-3">
          {searchResults.documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{doc.title || doc.fileName}</h3>
                      <p className="text-sm text-gray-600">{doc.fileType.toUpperCase()} • {formatFileSize(doc.fileSize)}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <Badge className={getStatusColor(doc.status)}>{doc.status}</Badge>
                      {doc.classification && (
                        <Badge className={getClassificationColor(doc.confidence)}>
                          {doc.classification}
                          {doc.confidence && ` (${(doc.confidence * 100).toFixed(0)}%)`}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Uploaded by {doc.uploadedBy.displayName}</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {searchResults.total > searchResults.limit && (
            <div className="flex gap-2 justify-center mt-4">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - searchResults.limit))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={offset + searchResults.limit >= searchResults.total}
                onClick={() => setOffset(offset + searchResults.limit)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isSearching && debouncedQuery.trim() && searchResults?.documents.length === 0 && (
        <Card>
          <CardContent className="pt-8 text-center">
            <p className="text-gray-500">No documents found matching your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      uploaded: "bg-blue-100 text-blue-800",
      processing: "bg-yellow-100 text-yellow-800",
      classified: "bg-purple-100 text-purple-800",
      reviewed: "bg-green-100 text-green-800",
      archived: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getClassificationColor = (confidence?: number) => {
    if (!confidence) return "bg-gray-100";
    if (confidence >= 0.8) return "bg-green-100 text-green-800";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="w-full space-y-6">
      {/* Search and Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Search Documents</CardTitle>
          <CardDescription>Find documents by title, classification, or content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Classification</label>
              <Select value={selectedClassification} onValueChange={setSelectedClassification}>
                <SelectTrigger disabled={isLoadingClassifications}>
                  <SelectValue placeholder="All classifications" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All classifications</SelectItem>
                  {classifications?.map((cls) => (
                    <SelectItem key={cls.value} value={cls.value || "unclassified"}>
                      {cls.label} ({cls.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All statuses</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="classified">Classified</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Results</label>
              <div className="text-sm text-gray-600 py-2">
                {isSearching ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </span>
                ) : searchResults ? (
                  <span>{searchResults.total} results found in {searchResults.executionMs}ms</span>
                ) : (
                  <span>Enter search query</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && searchResults.documents.length > 0 && (
        <div className="space-y-3">
          {searchResults.documents.map((doc) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{doc.title || doc.fileName}</h3>
                      <p className="text-sm text-gray-600">{doc.fileType.toUpperCase()} • {formatFileSize(doc.fileSize)}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <Badge className={getStatusColor(doc.status)}>{doc.status}</Badge>
                      {doc.classification && (
                        <Badge className={getClassificationColor(doc.confidence)}>
                          {doc.classification}
                          {doc.confidence && ` (${(doc.confidence * 100).toFixed(0)}%)`}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Uploaded by {doc.uploadedBy.displayName}</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {searchResults.total > searchResults.limit && (
            <div className="flex gap-2 justify-center mt-4">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - searchResults.limit))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={offset + searchResults.limit >= searchResults.total}
                onClick={() => setOffset(offset + searchResults.limit)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isSearching && debouncedQuery.trim() && searchResults?.documents.length === 0 && (
        <Card>
          <CardContent className="pt-8 text-center">
            <p className="text-gray-500">No documents found matching your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
