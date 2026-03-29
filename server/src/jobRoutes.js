import express from "express";
import { prisma } from "./db.js";
import { requireAuth, requireRole } from "./auth.js";
const router = express.Router();
// GET /api/jobs — list recent jobs (admin only)
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
    const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined;
    const jobs = await prisma.processingJob.findMany({
        where: statusFilter ? { status: statusFilter } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
            document: {
                select: {
                    id: true,
                    title: true,
                    mimeType: true,
                    originalFileName: true,
                    processingStatus: true,
                },
            },
        },
    });
    res.json(jobs.map((j) => ({
        id: j.id,
        documentId: j.documentId,
        document: j.document,
        status: j.status,
        attempts: j.attempts,
        maxAttempts: j.maxAttempts,
        error: j.error,
        errorLog: j.errorLog,
        scheduledAt: j.scheduledAt.toISOString(),
        nextRetryAt: j.nextRetryAt?.toISOString() ?? null,
        startedAt: j.startedAt?.toISOString() ?? null,
        completedAt: j.completedAt?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
    })));
});
// GET /api/jobs/stats — aggregate queue statistics (admin only)
router.get("/stats", requireAuth, requireRole("admin"), async (_req, res) => {
    const [queued, processing, completed, failed, deadLetter] = await Promise.all([
        prisma.processingJob.count({ where: { status: "queued" } }),
        prisma.processingJob.count({ where: { status: "processing" } }),
        prisma.processingJob.count({ where: { status: "completed" } }),
        prisma.processingJob.count({ where: { status: "failed" } }),
        prisma.processingJob.count({ where: { status: "dead_letter" } }),
    ]);
    // Average processing time for completed jobs (milliseconds)
    const completedJobs = await prisma.processingJob.findMany({
        where: {
            status: "completed",
            startedAt: { not: null },
            completedAt: { not: null },
        },
        select: { startedAt: true, completedAt: true },
        take: 500,
    });
    const avgMs = completedJobs.length > 0
        ? completedJobs.reduce((sum, j) => {
            const ms = j.completedAt.getTime() - j.startedAt.getTime();
            return sum + ms;
        }, 0) / completedJobs.length
        : null;
    res.json({
        queued,
        processing,
        completed,
        failed,
        deadLetter,
        totalActive: queued + processing,
        avgProcessingMs: avgMs !== null ? Math.round(avgMs) : null,
        sampledFromLast: completedJobs.length,
    });
});
export { router as jobRouter };
