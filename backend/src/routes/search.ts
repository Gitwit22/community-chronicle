import express, { Request, Response } from "express";
import prisma from "../db.js";

const router = express.Router();
const NXTLVL_API_URL = process.env.NXTLVL_API_URL || "http://localhost:4000";
const HAS_DATABASE = !!process.env.DATABASE_URL;

interface SearchQuery {
  q: string;
  organizationId: string;
  classification?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Proxy search through nxt-lvl-api if database not configured
// Otherwise use local database
router.post("/documents/search", async (req: Request, res: Response) => {
  try {
    const { q, organizationId, classification, status, startDate, endDate, limit = 20, offset = 0 } = req.body as SearchQuery;
    const { authorization } = req.headers;

    if (!q || !organizationId) {
      return res.status(400).json({ error: "Search query and organizationId are required" });
    }

    // If no local database, proxy to nxt-lvl-api
    if (!HAS_DATABASE) {
      const proxyUrl = `${NXTLVL_API_URL}/api/docs/search`;
      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authorization ? { authorization } : {}),
        },
        body: JSON.stringify({
          q,
          organizationId,
          classification,
          status,
          startDate,
          endDate,
          limit,
          offset,
        }),
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // Local search implementation
    const where: any = {
      organizationId,
      searchText: {
        search: q.split(" ").join(" | "),
      },
    };

    if (classification) {
      where.classification = classification;
    }
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const startTime = Date.now();

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          fileName: true,
          title: true,
          classification: true,
          status: true,
          confidence: true,
          fileType: true,
          fileSize: true,
          createdAt: true,
          uploadedBy: {
            select: { displayName: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.document.count({ where }),
    ]);

    const executionMs = Date.now() - startTime;

    // Log search for analytics
    await prisma.searchLog.create({
      data: {
        organizationId,
        query: q,
        resultCount: documents.length,
        executionMs,
      },
    });

    res.json({
      documents,
      total,
      limit,
      offset,
      executionMs,
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// Get document classifications
router.get("/classifications", async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query as { organizationId: string };
    const { authorization } = req.headers;

    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    // If no local database, proxy to nxt-lvl-api
    if (!HAS_DATABASE) {
      const proxyUrl = `${NXTLVL_API_URL}/api/docs/classifications?organizationId=${organizationId}`;
      const response = await fetch(proxyUrl, {
        headers: {
          ...(authorization ? { authorization } : {}),
        },
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // Local implementation
    const classifications = await prisma.document.groupBy({
      by: ["classification"],
      where: {
        organizationId,
        classification: { not: null },
      },
      _count: {
        id: true,
      },
      orderBy: { _count: { id: "desc" } },
    });

    const result = classifications.map((c) => ({
      label: c.classification || "Unknown",
      value: c.classification,
      count: c._count.id,
    }));

    res.json(result);
  } catch (error) {
    console.error("Classifications error:", error);
    res.status(500).json({ error: "Failed to fetch classifications" });
  }
});

// Get document statistics
router.get("/statistics", async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query as { organizationId: string };
    const { authorization } = req.headers;

    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }

    // If no local database, proxy to nxt-lvl-api
    if (!HAS_DATABASE) {
      const proxyUrl = `${NXTLVL_API_URL}/api/docs/statistics?organizationId=${organizationId}`;
      const response = await fetch(proxyUrl, {
        headers: {
          ...(authorization ? { authorization } : {}),
        },
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // Local implementation
    const [totalDocuments, byStatus, byClassification] = await Promise.all([
      prisma.document.count({ where: { organizationId } }),
      prisma.document.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { id: true },
      }),
      prisma.document.groupBy({
        by: ["classification"],
        where: { organizationId },
        _count: { id: true },
      }),
    ]);

    res.json({
      totalDocuments,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
      byClassification: Object.fromEntries(
        byClassification.map((c) => [c.classification || "unclassified", c._count.id])
      ),
    });
  } catch (error) {
    console.error("Statistics error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

export default router;
