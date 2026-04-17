/**
 * Document Intelligence Metrics Collector (Frontend)
 *
 * Collects performance metrics for document intelligence operations called
 * directly from Community Chronicle to the Core API. Stores metrics in
 * localStorage and provides real-time stats for debugging and monitoring.
 */

export type FrontendMetricsOperation = "parse" | "classify" | "extract" | "upload";

export interface FrontendDocIntelMetric {
  id: string; // nanoid or uuid
  timestamp: number; // Unix timestamp
  operation: FrontendMetricsOperation;
  durationMs: number;
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
  fileSize?: number; // in bytes
  mimeType?: string;
}

const STORAGE_KEY = "doc-intel-metrics";
const MAX_METRICS_IN_STORAGE = 500;

export class FrontendDocIntelMetricsCollector {
  private inMemoryMetrics: FrontendDocIntelMetric[] = [];

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Record a new metric for a document intelligence operation.
   */
  record(metric: Omit<FrontendDocIntelMetric, "id">): FrontendDocIntelMetric {
    const id = this.generateId();
    const fullMetric: FrontendDocIntelMetric = { id, ...metric };

    this.inMemoryMetrics.push(fullMetric);
    this.enforceMaxSize();
    this.saveToStorage();

    return fullMetric;
  }

  /**
   * Get all metrics currently in memory.
   */
  getAll(): FrontendDocIntelMetric[] {
    return [...this.inMemoryMetrics];
  }

  /**
   * Get metrics by operation type.
   */
  getByOperation(operation: FrontendMetricsOperation): FrontendDocIntelMetric[] {
    return this.inMemoryMetrics.filter((m) => m.operation === operation);
  }

  /**
   * Get metrics from the last N minutes.
   */
  getRecent(minutes: number): FrontendDocIntelMetric[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.inMemoryMetrics.filter((m) => m.timestamp > cutoff);
  }

  /**
   * Compute statistics for a set of metrics.
   */
  static computeStats(metrics: FrontendDocIntelMetric[]) {
    if (metrics.length === 0) {
      return null;
    }

    const durations = metrics.map((m) => m.durationMs).sort((a, b) => a - b);
    const successCount = metrics.filter((m) => m.success).length;

    return {
      count: metrics.length,
      successCount,
      failureCount: metrics.length - successCount,
      successRate: (successCount / metrics.length) * 100,
      avgDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
      medianDurationMs: durations[Math.floor(durations.length / 2)],
      p95DurationMs: durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1],
      p99DurationMs: durations[Math.floor(durations.length * 0.99)] || durations[durations.length - 1],
      minDurationMs: durations[0],
      maxDurationMs: durations[durations.length - 1],
    };
  }

  /**
   * Get aggregated statistics for all metrics.
   */
  getStats() {
    return {
      total: FrontendDocIntelMetricsCollector.computeStats(this.inMemoryMetrics),
      last10min: FrontendDocIntelMetricsCollector.computeStats(this.getRecent(10)),
      last1hour: FrontendDocIntelMetricsCollector.computeStats(this.getRecent(60)),
      byOperation: {
        parse: FrontendDocIntelMetricsCollector.computeStats(this.getByOperation("parse")),
        classify: FrontendDocIntelMetricsCollector.computeStats(this.getByOperation("classify")),
        extract: FrontendDocIntelMetricsCollector.computeStats(this.getByOperation("extract")),
        upload: FrontendDocIntelMetricsCollector.computeStats(this.getByOperation("upload")),
      },
    };
  }

  /**
   * Clear all metrics from memory and storage.
   */
  clear(): void {
    this.inMemoryMetrics = [];
    this.saveToStorage();
  }

  /**
   * Export metrics as JSON for debugging or analytics.
   */
  export(): string {
    return JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        metrics: this.inMemoryMetrics,
        stats: this.getStats(),
      },
      null,
      2,
    );
  }

  /**
   * Import metrics from previously exported JSON.
   */
  import(json: string): void {
    try {
      const data = JSON.parse(json);
      if (Array.isArray(data.metrics)) {
        this.inMemoryMetrics = data.metrics;
        this.enforceMaxSize();
        this.saveToStorage();
      }
    } catch (e) {
      console.error("Failed to import metrics", e);
    }
  }

  // Private methods

  private generateId(): string {
    return `metric-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private enforceMaxSize(): void {
    if (this.inMemoryMetrics.length > MAX_METRICS_IN_STORAGE) {
      this.inMemoryMetrics = this.inMemoryMetrics.slice(-MAX_METRICS_IN_STORAGE);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.inMemoryMetrics));
    } catch (e) {
      console.warn("Failed to save metrics to localStorage", e);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.inMemoryMetrics = parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to load metrics from localStorage", e);
    }
  }
}

// Global singleton instance
export const globalFrontendDocIntelMetrics = new FrontendDocIntelMetricsCollector();
