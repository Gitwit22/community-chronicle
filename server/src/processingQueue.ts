import fs from "fs/promises";
import { prisma } from "./db.js";

let running = false;
let timer: NodeJS.Timeout | null = null;

function appendHistory(existing: unknown, event: Record<string, unknown>) {
  const history = Array.isArray(existing) ? [...existing] : [];
  history.push(event);
  return history;
}

async function extractText(filePath: string | null, mimeType: string | null): Promise<{ text: string; confidence: number; warnings?: string[] }> {
  if (!filePath) {
    return { text: "", confidence: 0.1, warnings: ["No file path available"] };
  }

  if (mimeType?.startsWith("text/") || mimeType === "application/json" || mimeType === "text/csv") {
    const text = await fs.readFile(filePath, "utf8");
    return { text: text.slice(0, 200000), confidence: 0.98 };
  }

  if (mimeType === "application/pdf") {
    return {
      text: "",
      confidence: 0.35,
      warnings: ["PDF queued on server; OCR/extraction pipeline can be upgraded to cloud OCR for higher accuracy."],
    };
  }

  if (mimeType?.startsWith("image/")) {
    return {
      text: "",
      confidence: 0.2,
      warnings: ["Image OCR queued on server; configure OCR worker for production accuracy."],
    };
  }

  return { text: "", confidence: 0.1, warnings: ["No extractor for this MIME type"] };
}

async function processSingleJob(): Promise<void> {
  const job = await prisma.processingJob.findFirst({
    where: { status: "queued", scheduledAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    include: { document: true },
  });

  if (!job) return;

  await prisma.processingJob.update({
    where: { id: job.id },
    data: { status: "processing", startedAt: new Date(), attempts: { increment: 1 } },
  });

  const processingStartEvent = {
    timestamp: new Date().toISOString(),
    action: "processing_start",
    status: "processing",
    details: "Processing started on server worker",
  };

  await prisma.document.update({
    where: { id: job.documentId },
    data: {
      processingStatus: "processing",
      status: "extracting",
      statusUpdatedAt: new Date(),
      processingHistory: appendHistory(job.document.processingHistory, processingStartEvent),
      extraction: { status: "processing" },
    },
  });

  try {
    const extraction = await extractText(job.document.filePath, job.document.mimeType);
    const nowIso = new Date().toISOString();
    const doneEvent = {
      timestamp: nowIso,
      action: "processing_complete",
      status: "processed",
      details: "Document processed by server queue worker",
    };

    const needsReview = extraction.confidence < 0.7;

    await prisma.document.update({
      where: { id: job.documentId },
      data: {
        extractedText: extraction.text || `${job.document.title}\n\n${job.document.description}`,
        processingStatus: "processed",
        status: needsReview ? "review_required" : "archived",
        statusUpdatedAt: new Date(),
        needsReview,
        review: needsReview
          ? {
              required: true,
              reason: ["Low extraction confidence"],
              priority: "high",
            }
          : { required: false },
        extraction: {
          status: "complete",
          method: job.document.mimeType?.startsWith("image/")
            ? "ocr"
            : job.document.mimeType === "application/pdf"
            ? "pdf"
            : "text",
          confidence: extraction.confidence,
          extractedAt: nowIso,
          warningMessages: extraction.warnings,
        },
        extractedMetadata: {
          wordCount: extraction.text ? extraction.text.split(/\s+/).filter(Boolean).length : 0,
          detectedTitle: job.document.title,
          detectedAuthor: job.document.author,
        },
        processingHistory: appendHistory(job.document.processingHistory, doneEvent),
      },
    });

    await prisma.processingJob.update({
      where: { id: job.id },
      data: { status: "completed", completedAt: new Date(), error: null },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown processing error";

    await prisma.document.update({
      where: { id: job.documentId },
      data: {
        processingStatus: "failed",
        status: "failed",
        statusUpdatedAt: new Date(),
        needsReview: true,
        review: {
          required: true,
          reason: ["Processing failed"],
          priority: "high",
        },
        extraction: {
          status: "failed",
          errorMessage,
          extractedAt: new Date().toISOString(),
        },
        processingHistory: appendHistory(job.document.processingHistory, {
          timestamp: new Date().toISOString(),
          action: "processing_failed",
          status: "failed",
          details: errorMessage,
        }),
      },
    });

    await prisma.processingJob.update({
      where: { id: job.id },
      data: { status: "failed", error: errorMessage, completedAt: new Date() },
    });
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await processSingleJob();
  } finally {
    running = false;
  }
}

export async function enqueueProcessing(documentId: string): Promise<void> {
  await prisma.processingJob.create({
    data: {
      documentId,
      status: "queued",
      scheduledAt: new Date(),
    },
  });
}

export function startProcessingWorker(intervalMs = 2000): void {
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, intervalMs);
}

export function stopProcessingWorker(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
