/**
 * Page-First Intake API Routes
 *
 * Implements the page-first document architecture endpoints:
 *
 * POST   /documents/page-first/upload
 * GET    /documents/uploads/:uploadId/pages
 * GET    /documents/uploads/:uploadId/packets
 * PATCH  /documents/pages/:pageId/labels
 * POST   /documents/packets
 * PATCH  /documents/packets/:packetId
 * POST   /documents/packets/:packetId/pages
 * DELETE /documents/packets/:packetId/pages/:pageId
 * POST   /documents/uploads/:uploadId/regroup
 * GET    /documents/page-search
 * GET    /documents/packets/search
 *
 * Feature flag: COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE
 * When set to "true", new uploads use this flow instead of the legacy proxy.
 */

import express, { Request, Response } from "express";
import prisma from "../db.js";
import { suggestDocumentPackets } from "../utils/pageGrouping.js";

const router = express.Router();

const PAGE_FIRST_ENABLED =
  process.env.COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE === "true";

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag gate helper
// ─────────────────────────────────────────────────────────────────────────────

function requirePageFirst(req: Request, res: Response): boolean {
  if (!PAGE_FIRST_ENABLED) {
    res.status(503).json({
      error: "Page-first intake is not enabled.",
      hint: "Set COMMUNITY_CHRONICLE_PAGE_FIRST_INTAKE=true to enable.",
    });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /documents/page-first/upload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an OriginalUpload record and persist page-level data.
 *
 * Expected JSON body:
 * {
 *   orgId: string,
 *   uploadedById?: string,
 *   originalFileName: string,
 *   originalMimeType: string,
 *   originalFilePath: string,
 *   originalFileUrl?: string,
 *   pages: Array<{
 *     pageNumber: number,
 *     pageText?: string,
 *     pageImagePath?: string,
 *     detectedDocType?: string,
 *     detectedCompanyOrOrg?: string,
 *     detectedPersonName?: string,
 *     detectedMonth?: number,
 *     detectedYear?: number,
 *     detectedDate?: string,
 *     confidence?: number,
 *     needsReview?: boolean,
 *     rawExtractionJson?: unknown,
 *   }>
 * }
 */
router.post("/documents/page-first/upload", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const {
      orgId,
      uploadedById,
      originalFileName,
      originalMimeType,
      originalFilePath,
      originalFileUrl,
      pages = [],
    } = req.body as {
      orgId: string;
      uploadedById?: string;
      originalFileName: string;
      originalMimeType: string;
      originalFilePath: string;
      originalFileUrl?: string;
      pages: Array<{
        pageNumber: number;
        pageText?: string;
        pageImagePath?: string;
        detectedDocType?: string;
        detectedCompanyOrOrg?: string;
        detectedPersonName?: string;
        detectedMonth?: number;
        detectedYear?: number;
        detectedDate?: string;
        confidence?: number;
        needsReview?: boolean;
        rawExtractionJson?: unknown;
      }>;
    };

    if (!orgId || !originalFileName || !originalMimeType || !originalFilePath) {
      return res.status(400).json({
        error: "orgId, originalFileName, originalMimeType, and originalFilePath are required.",
      });
    }

    const upload = await prisma.originalUpload.create({
      data: {
        orgId,
        uploadedById: uploadedById ?? null,
        originalFileName,
        originalMimeType,
        originalFilePath,
        originalFileUrl: originalFileUrl ?? null,
        pageCount: pages.length,
        processingStatus: pages.length > 0 ? "review_ready" : "uploaded",
        pages: {
          create: pages.map((p) => ({
            orgId,
            pageNumber: p.pageNumber,
            pageText: p.pageText ?? null,
            pageImagePath: p.pageImagePath ?? null,
            detectedDocType: p.detectedDocType ?? null,
            detectedCompanyOrOrg: p.detectedCompanyOrOrg ?? null,
            detectedPersonName: p.detectedPersonName ?? null,
            detectedMonth: p.detectedMonth ?? null,
            detectedYear: p.detectedYear ?? null,
            detectedDate: p.detectedDate ?? null,
            confidence: p.confidence ?? 0,
            needsReview: p.needsReview ?? false,
            processingStatus: p.pageText ? "labeled" : "pending",
            rawExtractionJson: p.rawExtractionJson !== undefined ? (p.rawExtractionJson as object) : undefined,
          })),
        },
      },
    });

    res.status(201).json({
      originalUploadId: upload.id,
      pageCount: upload.pageCount,
      processingStatus: upload.processingStatus,
    });
  } catch (error) {
    console.error("page-first upload error:", error);
    res.status(500).json({ error: "Failed to create upload record." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /documents/uploads/:uploadId/pages
// ─────────────────────────────────────────────────────────────────────────────

router.get("/documents/uploads/:uploadId/pages", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const { uploadId } = req.params;
    const pages = await prisma.documentPage.findMany({
      where: { originalUploadId: uploadId },
      orderBy: { pageNumber: "asc" },
    });
    res.json({ pages });
  } catch (error) {
    console.error("get pages error:", error);
    res.status(500).json({ error: "Failed to fetch pages." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /documents/uploads/:uploadId/packets
// ─────────────────────────────────────────────────────────────────────────────

router.get("/documents/uploads/:uploadId/packets", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const { uploadId } = req.params;
    const packets = await prisma.documentPacket.findMany({
      where: { originalUploadId: uploadId },
      include: { pages: { orderBy: { orderIndex: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ packets });
  } catch (error) {
    console.error("get packets error:", error);
    res.status(500).json({ error: "Failed to fetch packets." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /documents/pages/:pageId/labels
// ─────────────────────────────────────────────────────────────────────────────

router.patch("/documents/pages/:pageId/labels", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const { pageId } = req.params;
    const {
      detectedDocType,
      detectedCompanyOrOrg,
      detectedPersonName,
      detectedMonth,
      detectedYear,
      detectedDate,
      needsReview,
    } = req.body as {
      detectedDocType?: string | null;
      detectedCompanyOrOrg?: string | null;
      detectedPersonName?: string | null;
      detectedMonth?: number | null;
      detectedYear?: number | null;
      detectedDate?: string | null;
      needsReview?: boolean;
    };

    const updated = await prisma.documentPage.update({
      where: { id: pageId },
      data: {
        ...(detectedDocType !== undefined ? { detectedDocType } : {}),
        ...(detectedCompanyOrOrg !== undefined ? { detectedCompanyOrOrg } : {}),
        ...(detectedPersonName !== undefined ? { detectedPersonName } : {}),
        ...(detectedMonth !== undefined ? { detectedMonth } : {}),
        ...(detectedYear !== undefined ? { detectedYear } : {}),
        ...(detectedDate !== undefined ? { detectedDate } : {}),
        ...(needsReview !== undefined ? { needsReview } : {}),
      },
    });

    res.json({ page: updated });
  } catch (error) {
    console.error("patch page labels error:", error);
    res.status(500).json({ error: "Failed to update page labels." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /documents/packets
// ─────────────────────────────────────────────────────────────────────────────

router.post("/documents/packets", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const {
      orgId,
      originalUploadId,
      title,
      packetType,
      primaryCompanyOrOrg,
      primaryPersonName,
      detectedMonth,
      detectedYear,
      pageIds = [],
    } = req.body as {
      orgId: string;
      originalUploadId?: string;
      title: string;
      packetType?: string;
      primaryCompanyOrOrg?: string;
      primaryPersonName?: string;
      detectedMonth?: number;
      detectedYear?: number;
      pageIds: string[];
    };

    if (!orgId || !title) {
      return res.status(400).json({ error: "orgId and title are required." });
    }

    const packet = await prisma.documentPacket.create({
      data: {
        orgId,
        originalUploadId: originalUploadId ?? null,
        title,
        packetType: packetType ?? null,
        primaryCompanyOrOrg: primaryCompanyOrOrg ?? null,
        primaryPersonName: primaryPersonName ?? null,
        detectedMonth: detectedMonth ?? null,
        detectedYear: detectedYear ?? null,
        confidence: 1.0,
        needsReview: false,
        status: "approved",
        pages: {
          create: pageIds.map((pageId, i) => ({
            pageId,
            orderIndex: i,
            relationshipType: i === 0 ? "primary" : "continuation",
          })),
        },
      },
      include: { pages: true },
    });

    res.status(201).json({ packet });
  } catch (error) {
    console.error("create packet error:", error);
    res.status(500).json({ error: "Failed to create packet." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /documents/packets/:packetId
// ─────────────────────────────────────────────────────────────────────────────

router.patch("/documents/packets/:packetId", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const { packetId } = req.params;
    const {
      title,
      packetType,
      primaryCompanyOrOrg,
      primaryPersonName,
      detectedMonth,
      detectedYear,
      status,
    } = req.body as {
      title?: string;
      packetType?: string | null;
      primaryCompanyOrOrg?: string | null;
      primaryPersonName?: string | null;
      detectedMonth?: number | null;
      detectedYear?: number | null;
      status?: string;
    };

    const updated = await prisma.documentPacket.update({
      where: { id: packetId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(packetType !== undefined ? { packetType } : {}),
        ...(primaryCompanyOrOrg !== undefined ? { primaryCompanyOrOrg } : {}),
        ...(primaryPersonName !== undefined ? { primaryPersonName } : {}),
        ...(detectedMonth !== undefined ? { detectedMonth } : {}),
        ...(detectedYear !== undefined ? { detectedYear } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });

    res.json({ packet: updated });
  } catch (error) {
    console.error("patch packet error:", error);
    res.status(500).json({ error: "Failed to update packet." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /documents/packets/:packetId/pages
// ─────────────────────────────────────────────────────────────────────────────

router.post("/documents/packets/:packetId/pages", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const { packetId } = req.params;
    const { pageId, relationshipType = "continuation" } = req.body as {
      pageId: string;
      relationshipType?: string;
    };

    if (!pageId) {
      return res.status(400).json({ error: "pageId is required." });
    }

    // Get current max orderIndex
    const existing = await prisma.documentPacketPage.findMany({
      where: { packetId },
      orderBy: { orderIndex: "desc" },
      take: 1,
    });
    const nextIndex = existing.length > 0 ? existing[0].orderIndex + 1 : 0;

    const packetPage = await prisma.documentPacketPage.create({
      data: {
        packetId,
        pageId,
        orderIndex: nextIndex,
        relationshipType,
      },
    });

    res.status(201).json({ packetPage });
  } catch (error) {
    console.error("attach page to packet error:", error);
    res.status(500).json({ error: "Failed to attach page to packet." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /documents/packets/:packetId/pages/:pageId
// ─────────────────────────────────────────────────────────────────────────────

router.delete("/documents/packets/:packetId/pages/:pageId", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const { packetId, pageId } = req.params;

    await prisma.documentPacketPage.deleteMany({
      where: { packetId, pageId },
    });

    res.json({ detached: true });
  } catch (error) {
    console.error("detach page from packet error:", error);
    res.status(500).json({ error: "Failed to detach page from packet." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /documents/uploads/:uploadId/regroup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-run the grouping engine for an upload using current page labels.
 * Deletes existing suggested packets and creates fresh suggestions.
 * Does NOT delete packets with status "approved".
 */
router.post("/documents/uploads/:uploadId/regroup", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const { uploadId } = req.params;

    // Load all pages in order
    const pages = await prisma.documentPage.findMany({
      where: { originalUploadId: uploadId },
      orderBy: { pageNumber: "asc" },
    });

    if (pages.length === 0) {
      return res.status(404).json({ error: "No pages found for this upload." });
    }

    // Build labeled pages from stored data
    const labeledPages = pages.map((p) => ({
      pageNumber: p.pageNumber,
      pageId: p.id,
      pageText: p.pageText ?? "",
      label: {
        detectedDocType: p.detectedDocType,
        detectedCompanyOrOrg: p.detectedCompanyOrOrg,
        detectedPersonName: p.detectedPersonName,
        detectedMonth: p.detectedMonth,
        detectedYear: p.detectedYear,
        detectedDate: p.detectedDate,
        confidence: p.confidence,
        needsReview: p.needsReview,
      },
    }));

    // Delete existing suggested packets (leave approved alone)
    await prisma.documentPacket.deleteMany({
      where: { originalUploadId: uploadId, status: "suggested" },
    });

    // Run grouping engine
    const proposals = suggestDocumentPackets(labeledPages);

    // Persist new suggested packets
    const created = await Promise.all(
      proposals.map((proposal) =>
        prisma.documentPacket.create({
          data: {
            orgId: pages[0].orgId,
            originalUploadId: uploadId,
            title: proposal.title,
            packetType: proposal.packetType ?? null,
            primaryCompanyOrOrg: proposal.primaryCompanyOrOrg ?? null,
            primaryPersonName: proposal.primaryPersonName ?? null,
            detectedMonth: proposal.detectedMonth ?? null,
            detectedYear: proposal.detectedYear ?? null,
            confidence: proposal.confidence,
            needsReview: proposal.needsReview,
            status: "suggested",
            pages: {
              create: proposal.pages.map((pp) => ({
                pageId: pp.pageId ?? pages[pp.pageNumber - 1]?.id ?? "",
                orderIndex: pp.orderIndex,
                relationshipType: pp.relationshipType,
              })),
            },
          },
          include: { pages: { orderBy: { orderIndex: "asc" } } },
        }),
      ),
    );

    res.json({ packets: created });
  } catch (error) {
    console.error("regroup error:", error);
    res.status(500).json({ error: "Failed to regroup pages into packets." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /documents/page-search
// ─────────────────────────────────────────────────────────────────────────────

router.get("/documents/page-search", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const {
      q,
      type,
      person,
      organization,
      month,
      year,
      dateFrom,
      dateTo,
      packetId,
      uploadId,
      limit: limitStr = "20",
      offset: offsetStr = "0",
    } = req.query as Record<string, string>;

    const limit = Math.min(Math.max(Number(limitStr), 1), 100);
    const offset = Math.max(Number(offsetStr), 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (uploadId) where.originalUploadId = uploadId;
    if (type) where.detectedDocType = { contains: type, mode: "insensitive" };
    if (person) where.detectedPersonName = { contains: person, mode: "insensitive" };
    if (organization) where.detectedCompanyOrOrg = { contains: organization, mode: "insensitive" };
    if (month) where.detectedMonth = Number(month);
    if (year) where.detectedYear = Number(year);

    if (dateFrom || dateTo) {
      where.detectedDate = {};
      if (dateFrom) where.detectedDate.gte = dateFrom;
      if (dateTo) where.detectedDate.lte = dateTo;
    }

    if (q) {
      where.OR = [
        { pageText: { contains: q, mode: "insensitive" } },
        { detectedDocType: { contains: q, mode: "insensitive" } },
        { detectedCompanyOrOrg: { contains: q, mode: "insensitive" } },
        { detectedPersonName: { contains: q, mode: "insensitive" } },
      ];
    }

    if (packetId) {
      const packetPageIds = await prisma.documentPacketPage.findMany({
        where: { packetId },
        select: { pageId: true },
      });
      where.id = { in: packetPageIds.map((pp) => pp.pageId) };
    }

    const [pages, total] = await Promise.all([
      prisma.documentPage.findMany({
        where,
        orderBy: [{ detectedYear: "desc" }, { detectedMonth: "desc" }, { pageNumber: "asc" }],
        take: limit,
        skip: offset,
      }),
      prisma.documentPage.count({ where }),
    ]);

    res.json({ pages, total, limit, offset });
  } catch (error) {
    console.error("page-search error:", error);
    res.status(500).json({ error: "Page search failed." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /documents/packets/search
// ─────────────────────────────────────────────────────────────────────────────

router.get("/documents/packets/search", async (req: Request, res: Response) => {
  if (!requirePageFirst(req, res)) return;

  try {
    const {
      q,
      type,
      person,
      organization,
      month,
      year,
      status,
      limit: limitStr = "20",
      offset: offsetStr = "0",
    } = req.query as Record<string, string>;

    const limit = Math.min(Math.max(Number(limitStr), 1), 100);
    const offset = Math.max(Number(offsetStr), 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (type) where.packetType = { contains: type, mode: "insensitive" };
    if (person) where.primaryPersonName = { contains: person, mode: "insensitive" };
    if (organization) where.primaryCompanyOrOrg = { contains: organization, mode: "insensitive" };
    if (month) where.detectedMonth = Number(month);
    if (year) where.detectedYear = Number(year);
    if (status) where.status = status;

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { packetType: { contains: q, mode: "insensitive" } },
        { primaryCompanyOrOrg: { contains: q, mode: "insensitive" } },
        { primaryPersonName: { contains: q, mode: "insensitive" } },
      ];
    }

    const [packets, total] = await Promise.all([
      prisma.documentPacket.findMany({
        where,
        include: { pages: { orderBy: { orderIndex: "asc" } } },
        orderBy: [{ detectedYear: "desc" }, { detectedMonth: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.documentPacket.count({ where }),
    ]);

    res.json({ packets, total, limit, offset });
  } catch (error) {
    console.error("packets/search error:", error);
    res.status(500).json({ error: "Packet search failed." });
  }
});

export default router;
