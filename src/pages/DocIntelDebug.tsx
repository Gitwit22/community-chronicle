import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_BASE } from "@/lib/apiBase";
import { getAuthHeaders } from "@/lib/tokenStorage";
import { globalFrontendDocIntelMetrics, type FrontendDocIntelMetric } from "@/lib/docIntelMetrics";

type BackendPayload = {
  timestamp: string;
  stats?: unknown;
};

function formatMs(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${Math.round(value)} ms`;
}

function formatPct(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

export default function DocIntelDebug() {
  const [localMetrics, setLocalMetrics] = useState<FrontendDocIntelMetric[]>([]);
  const [backendMetrics, setBackendMetrics] = useState<BackendPayload | null>(null);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localStats = useMemo(() => globalFrontendDocIntelMetrics.getStats(), [localMetrics]);

  const refreshLocal = () => {
    setLocalMetrics(globalFrontendDocIntelMetrics.getAll().slice().reverse());
  };

  const refreshBackend = async () => {
    setLoadingBackend(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/metrics/doc-intel`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to load backend metrics (${response.status})`);
      }
      const payload = (await response.json()) as BackendPayload;
      setBackendMetrics(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingBackend(false);
    }
  };

  const clearLocal = () => {
    globalFrontendDocIntelMetrics.clear();
    refreshLocal();
  };

  const clearBackend = async () => {
    setLoadingBackend(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/metrics/doc-intel/clear`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Failed to clear backend metrics (${response.status})`);
      }
      await refreshBackend();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingBackend(false);
    }
  };

  useEffect(() => {
    refreshLocal();
    void refreshBackend();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Doc Intel Metrics Debug</h1>
          <p className="text-sm text-muted-foreground">
            Compare direct frontend Core API metrics with backend queue metrics.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshLocal}>Refresh Local</Button>
          <Button variant="outline" onClick={() => void refreshBackend()} disabled={loadingBackend}>Refresh Backend</Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Frontend Metrics</CardTitle>
            <CardDescription>Direct browser calls to Core API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Count: {localMetrics.length}</Badge>
              <Badge variant="secondary">
                Success: {formatPct((localStats.total as { successRate?: number } | null)?.successRate)}
              </Badge>
              <Badge variant="secondary">
                P95: {formatMs((localStats.total as { p95DurationMs?: number } | null)?.p95DurationMs)}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearLocal}>Clear Local</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backend Metrics</CardTitle>
            <CardDescription>Queue path calls from nxt-lvl-api to Core API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                Snapshot: {backendMetrics?.timestamp ? new Date(backendMetrics.timestamp).toLocaleTimeString() : "-"}
              </Badge>
              <Badge variant="secondary">Status: {loadingBackend ? "Loading" : "Ready"}</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void clearBackend()} disabled={loadingBackend}>Clear Backend</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Frontend Operations</CardTitle>
          <CardDescription>Most recent direct Core API operations from this browser</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Time</th>
                  <th className="text-left p-2">Operation</th>
                  <th className="text-left p-2">Success</th>
                  <th className="text-left p-2">Duration</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {localMetrics.slice(0, 25).map((metric) => (
                  <tr key={metric.id} className="border-b">
                    <td className="p-2">{new Date(metric.timestamp).toLocaleTimeString()}</td>
                    <td className="p-2">{metric.operation}</td>
                    <td className="p-2">{metric.success ? "yes" : "no"}</td>
                    <td className="p-2">{formatMs(metric.durationMs)}</td>
                    <td className="p-2">{metric.statusCode ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw Backend Snapshot</CardTitle>
          <CardDescription>Current payload from /api/metrics/doc-intel</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto max-h-96 bg-muted p-3 rounded-md">
            {JSON.stringify(backendMetrics, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
