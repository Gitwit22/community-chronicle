import fs from "fs/promises";
import { prisma } from "./db.js";
import { logger } from "./logger.js";
import { MAX_ATTEMPTS, JOB_TIMEOUT_MS, RETRY_BACKOFF_BASE_MS, SCANNED_PDF_WORDS_PER_PAGE_THRESHOLD, OCR_CONFIDENCE_REVIEW_THRESHOLD, MAX_FILE_SIZE_BYTES, } from "./config.js";
let workerRunning = false;
let workerTimer = null;
// ---------------------------------------------------------------------------
// Timeout wrapper
// ---------------------------------------------------------------------------
function withTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
        const id = setTimeout(() => reject(new Error(`Processing timed out after ${timeoutMs}ms (${label})`)), timeoutMs);
        promise.then((v) => { clearTimeout(id); resolve(v); }, (e) => { clearTimeout(id); reject(e); });
    });
}
// ---------------------------------------------------------------------------
// Plain text extractor
// ---------------------------------------------------------------------------
async function extractPlainText(filePath) {
    const text = await fs.readFile(filePath, "utf8");
    return { text: text.slice(0, 200_000), confidence: 0.98, method: "text" };
}
// ---------------------------------------------------------------------------
// PDF extractor (pdf-parse)
// ---------------------------------------------------------------------------
async function extractPdf(filePath) {
    // Dynamic import keeps pdf-parse out of the module graph until needed.
    const { default: pdfParse } = await import("pdf-parse");
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    const rawText = (data.text || "").trim();
    const wordCount = rawText.split(/\s+/).filter(Boolean).length;
    const pageCount = data.numpages || 1;
    const wordsPerPage = wordCount / pageCount;
    if (wordsPerPage < SCANNED_PDF_WORDS_PER_PAGE_THRESHOLD) {
        return {
            text: rawText,
            confidence: 0.3,
            method: "pdf_scanned",
            pageCount,
            warnings: [
                `PDF appears to be scanned (${Math.round(wordsPerPage)} words/page < threshold ${SCANNED_PDF_WORDS_PER_PAGE_THRESHOLD}).`,
                "Full scanned-PDF OCR requires system-level tools (e.g. poppler). Document flagged for manual review.",
            ],
        };
    }
    return {
        text: rawText.slice(0, 200_000),
        confidence: 0.92,
        method: "pdf",
        pageCount,
    };
}
// ---------------------------------------------------------------------------
// Image OCR extractor (tesseract.js)
// ---------------------------------------------------------------------------
async function extractImage(filePath) {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
        const { data } = await worker.recognize(filePath);
        const confidence = (data.confidence ?? 0) / 100;
        return {
            text: (data.text || "").slice(0, 200_000),
            confidence,
            method: "ocr",
        };
    }
    finally {
        await worker.terminate();
    }
}
// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------
async function runExtraction(filePath, mimeType) {
    if (!filePath) {
        return { text: "", confidence: 0.1, method: "unsupported", warnings: ["No file path"] };
    }
    // File size guard
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat && stat.size > MAX_FILE_SIZE_BYTES) {
        return {
            text: "",
            confidence: 0.1,
            method: "unsupported",
            warnings: [
                `File size ${stat.size} bytes exceeds processing limit of ${MAX_FILE_SIZE_BYTES} bytes. Manual review required.`,
            ],
        };
    }
    if (mimeType === "application/pdf")
        return extractPdf(filePath);
    if (mimeType?.startsWith("image/"))
        return extractImage(filePath);
    if (mimeType?.startsWith("text/") ||
        mimeType === "application/json" ||
        mimeType === "text/csv") {
        return extractPlainText(filePath);
    }
    return {
        text: "",
        confidence: 0.1,
        method: "unsupported",
        warnings: [`No extractor available for MIME type '${mimeType}'.`],
    };
}
// ---------------------------------------------------------------------------
// History helper
// ---------------------------------------------------------------------------
function appendHistory(existing, event) {
    const history = Array.isArray(existing) ? [...existing] : [];
    history.push(event);
    return history;
}
// ---------------------------------------------------------------------------
// Failure handler — retry with backoff or dead-letter
// ---------------------------------------------------------------------------
async function handleJobFailure(job, error) {
    const errorEntry = {
        attempt: job.attempts,
        timestamp: new Date().toISOString(),
        error: error.message,
    };
    const errorLog = [
        ...(Array.isArray(job.errorLog) ? job.errorLog : []),
        errorEntry,
    ];
    const isDeadLetter = job.attempts >= job.maxAttempts;
    if (isDeadLetter) {
        logger.error("Job permanently failed — dead-lettered", {
            jobId: job.id,
            documentId: job.documentId,
            attempts: job.attempts,
            error: error.message,
        });
        await prisma.processingJob.update({
            where: { id: job.id },
            data: {
                status: "dead_letter",
                error: error.message,
                errorLog,
                completedAt: new Date(),
            },
        });
        await prisma.document.update({
            where: { id: job.documentId },
            data: {
                processingStatus: "failed",
                status: "failed",
                statusUpdatedAt: new Date(),
                needsReview: true,
                review: {
                    required: true,
                    reason: ["Processing permanently failed after maximum retries"],
                    priority: "high",
                },
                extraction: {
                    status: "failed",
                    errorMessage: error.message,
                    extractedAt: new Date().toISOString(),
                },
                processingHistory: appendHistory(job.document.processingHistory, {
                    timestamp: new Date().toISOString(),
                    action: "dead_letter",
                    status: "failed",
                    details: `Permanently failed after ${job.attempts} attempt(s): ${error.message}`,
                }),
            },
        });
    }
    else {
        // Exponential backoff: attempt 1 → 5s, attempt 2 → 10s, attempt 3 → 20s
        const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, job.attempts - 1);
        const nextRetryAt = new Date(Date.now() + backoffMs);
        logger.warn("Job failed — scheduling retry", {
            jobId: job.id,
            documentId: job.documentId,
            attempt: job.attempts,
            maxAttempts: job.maxAttempts,
            nextRetryAt: nextRetryAt.toISOString(),
            error: error.message,
        });
        await prisma.processingJob.update({
            where: { id: job.id },
            data: {
                status: "queued",
                scheduledAt: nextRetryAt,
                nextRetryAt,
                error: error.message,
                errorLog,
            },
        });
        await prisma.document.update({
            where: { id: job.documentId },
            data: {
                processingStatus: "queued",
                status: "queued",
                statusUpdatedAt: new Date(),
                processingHistory: appendHistory(job.document.processingHistory, {
                    timestamp: new Date().toISOString(),
                    action: "retry_scheduled",
                    status: "queued",
                    details: `Attempt ${job.attempts} failed. Retry ${job.attempts + 1} scheduled at ${nextRetryAt.toISOString()}.`,
                }),
            },
        });
    }
}
// ---------------------------------------------------------------------------
// Core job processor
// ---------------------------------------------------------------------------
async function processSingleJob() {
    const job = await prisma.processingJob.findFirst({
        where: {
            status: "queued",
            scheduledAt: { lte: new Date() },
        },
        orderBy: { createdAt: "asc" },
        include: { document: true },
    });
    if (!job)
        return;
    // Mark as processing immediately to prevent duplicate pickup
    await prisma.processingJob.update({
        where: { id: job.id },
        data: {
            status: "processing",
            startedAt: new Date(),
            attempts: { increment: 1 },
        },
    });
    // Re-fetch after increment so we have the current attempt count + errorLog
    const updatedJob = await prisma.processingJob.findUniqueOrThrow({
        where: { id: job.id },
        include: { document: true },
    });
    await prisma.document.update({
        where: { id: job.documentId },
        data: {
            processingStatus: "processing",
            status: "extracting",
            statusUpdatedAt: new Date(),
            processingHistory: appendHistory(job.document.processingHistory, {
                timestamp: new Date().toISOString(),
                action: "processing_start",
                status: "processing",
                details: `Processing started (attempt ${updatedJob.attempts})`,
            }),
            extraction: { status: "processing" },
        },
    });
    logger.info("Processing job started", {
        jobId: job.id,
        documentId: job.documentId,
        attempt: updatedJob.attempts,
        mimeType: job.document.mimeType,
    });
    try {
        const extraction = await withTimeout(runExtraction(job.document.filePath, job.document.mimeType), JOB_TIMEOUT_MS, job.document.mimeType ?? "unknown");
        const nowIso = new Date().toISOString();
        const needsReview = extraction.confidence < OCR_CONFIDENCE_REVIEW_THRESHOLD;
        const docRecord = job.document;
        await prisma.document.update({
            where: { id: job.documentId },
            data: {
                extractedText: extraction.text ||
                    `${job.document.title}\n\n${typeof docRecord.description === "string" ? docRecord.description : ""}`,
                processingStatus: "processed",
                status: needsReview ? "review_required" : "archived",
                statusUpdatedAt: new Date(),
                needsReview,
                review: needsReview
                    ? {
                        required: true,
                        reason: [
                            extraction.method === "pdf_scanned"
                                ? "Scanned PDF — manual OCR review required"
                                : "Low extraction confidence",
                            ...(extraction.warnings ?? []),
                        ],
                        priority: "high",
                    }
                    : { required: false },
                extraction: {
                    status: "complete",
                    method: extraction.method,
                    confidence: extraction.confidence,
                    extractedAt: nowIso,
                    pageCount: extraction.pageCount ?? null,
                    warningMessages: extraction.warnings ?? [],
                },
                extractedMetadata: {
                    wordCount: extraction.text
                        ? extraction.text.split(/\s+/).filter(Boolean).length
                        : 0,
                    detectedTitle: job.document.title,
                    detectedAuthor: job.document.author,
                },
                processingHistory: appendHistory(job.document.processingHistory, {
                    timestamp: nowIso,
                    action: "processing_complete",
                    status: "processed",
                    details: `Processed via '${extraction.method}' (confidence ${Math.round(extraction.confidence * 100)}%)`,
                }),
            },
        });
        await prisma.processingJob.update({
            where: { id: job.id },
            data: { status: "completed", completedAt: new Date(), error: null },
        });
        logger.info("Processing job completed", {
            jobId: job.id,
            documentId: job.documentId,
            method: extraction.method,
            confidence: extraction.confidence,
            needsReview,
        });
    }
    catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        await handleJobFailure(updatedJob, err);
    }
}
// ---------------------------------------------------------------------------
// Worker loop
// ---------------------------------------------------------------------------
async function tick() {
    if (workerRunning)
        return;
    workerRunning = true;
    try {
        await processSingleJob();
    }
    catch (err) {
        logger.error("Unexpected error in processing worker tick", {
            error: err instanceof Error ? err.message : String(err),
        });
    }
    finally {
        workerRunning = false;
    }
}
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function enqueueProcessing(documentId, options) {
    const scheduledAt = options?.delayMs
        ? new Date(Date.now() + options.delayMs)
        : new Date();
    await prisma.processingJob.create({
        data: {
            documentId,
            status: "queued",
            scheduledAt,
            maxAttempts: options?.maxAttempts ?? MAX_ATTEMPTS,
        },
    });
}
export function startProcessingWorker(intervalMs = 2000) {
    if (workerTimer)
        return;
    workerTimer = setInterval(() => {
        void tick();
    }, intervalMs);
    logger.info("Processing worker started", { intervalMs });
}
export function stopProcessingWorker() {
    if (!workerTimer)
        return;
    clearInterval(workerTimer);
    workerTimer = null;
    logger.info("Processing worker stopped");
}
// Exported for tests
export { processSingleJob, handleJobFailure, runExtraction };
