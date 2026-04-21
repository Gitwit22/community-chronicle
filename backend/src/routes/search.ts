import express, { Request, Response } from "express";
import prisma from "../db.js";
import type { Prisma } from "@prisma/client";

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
    const where: Prisma.DocumentWhereInput = {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { author: { contains: q, mode: "insensitive" } },
        { extractedText: { contains: q, mode: "insensitive" } },
      ],
    };

    if (classification) {
      // Local DB stores document type in `type`; external API may call it classification.
      where.type = classification;
    }
    if (status) {
      where.processingStatus = status;
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
          originalFileName: true,
          title: true,
          type: true,
          status: true,
          processingStatus: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
          uploadedById: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.document.count({ where }),
    ]);

    const executionMs = Date.now() - startTime;

    res.json({
      documents: documents.map((doc) => ({
        ...doc,
        fileName: doc.originalFileName,
        classification: doc.type,
        fileType: doc.mimeType,
      })),
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
    const classificationRows = await prisma.document.findMany({
      where: {
        type: { not: "" },
      },
      select: {
        type: true,
      },
    });

    const classificationCounts = classificationRows.reduce<Record<string, number>>((acc, row) => {
      const key = row.type || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const result = Object.entries(classificationCounts)
      .map(([value, count]) => ({
        label: value || "Unknown",
        value,
        count,
      }))
      .sort((a, b) => b.count - a.count);

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
    const [totalDocuments, rows] = await Promise.all([
      prisma.document.count(),
      prisma.document.findMany({
        select: {
          status: true,
          type: true,
        },
      }),
    ]);

    const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.status ?? "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const byClassification = rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.type || "unclassified";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    res.json({
      totalDocuments,
      byStatus,
      byClassification,
    });
  } catch (error) {
    console.error("Statistics error:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

export default router;
