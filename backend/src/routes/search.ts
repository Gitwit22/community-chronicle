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

interface MetaSearchQuery {
  person?: string;
  personRole?: string;
  company?: string;
  location?: string;
  referenceNumber?: string;
  sourceName?: string;
  documentType?: string;
  keyword?: string;
  limit?: string;
  offset?: string;
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

// Metadata-focused search (Step 1 index fields)
router.get("/documents/search-meta", async (req: Request, res: Response) => {
  try {
    const query = req.query as MetaSearchQuery;
    const { authorization } = req.headers;

    const person = query.person?.trim();
    const personRole = query.personRole?.trim();
    const company = query.company?.trim();
    const location = query.location?.trim();
    const referenceNumber = query.referenceNumber?.trim();
    const sourceName = query.sourceName?.trim();
    const documentType = query.documentType?.trim();
    const keyword = query.keyword?.trim();
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 200);
    const offset = Math.max(Number(query.offset ?? 0), 0);

    if (!HAS_DATABASE) {
      const params = new URLSearchParams();
      if (person) params.set("person", person);
      if (personRole) params.set("personRole", personRole);
      if (company) params.set("company", company);
      if (location) params.set("location", location);
      if (referenceNumber) params.set("referenceNumber", referenceNumber);
      if (sourceName) params.set("sourceName", sourceName);
      if (documentType) params.set("documentType", documentType);
      if (keyword) params.set("keyword", keyword);
      params.set("limit", String(limit));
      params.set("offset", String(offset));

      const proxyUrl = `${NXTLVL_API_URL}/api/docs/documents/search-meta?${params.toString()}`;
      const response = await fetch(proxyUrl, {
        headers: {
          ...(authorization ? { authorization } : {}),
        },
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // Local fallback: best-effort filtering against title/description/author/searchText
    const contains = (value: string, needle: string) => value.toLowerCase().includes(needle.toLowerCase());

    const docs = await prisma.document.findMany({
      where: {
        ...(documentType ? { type: documentType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit * 3,
      skip: offset,
    });

    const filtered = docs.filter((doc) => {
      const extracted = (doc.extractedData ?? {}) as Record<string, unknown>;
      const stepOne = (extracted.stepOne ?? {}) as Record<string, unknown>;
      const people = Array.isArray(stepOne.people) ? stepOne.people as Array<Record<string, unknown>> : [];
      const peopleNames = people.map((p) => String(p.name ?? "")).filter(Boolean);
      const companies = Array.isArray(extracted.companies) ? extracted.companies.map(String) : [];
      const locations = Array.isArray(extracted.locations) ? extracted.locations.map(String) : [];
      const refs = Array.isArray(extracted.referenceNumbers) ? extracted.referenceNumbers.map(String) : [];
      const source = String(extracted.sourceName ?? "");

      if (person) {
        const hasPerson = peopleNames.some((name) => contains(name, person));
        if (!hasPerson) return false;
      }

      if (personRole) {
        const hasRole = people.some((p) => {
          const role = String(p.role ?? "");
          const name = String(p.name ?? "");
          if (role.toLowerCase() !== personRole.toLowerCase()) return false;
          if (!person) return true;
          return contains(name, person);
        });
        if (!hasRole) return false;
      }

      if (company && !companies.some((c) => contains(c, company))) return false;
      if (location && !locations.some((l) => contains(l, location))) return false;
      if (referenceNumber && !refs.some((r) => contains(r, referenceNumber))) return false;
      if (sourceName && !contains(source, sourceName)) return false;

      if (keyword) {
        const haystack = [
          doc.title,
          doc.description,
          doc.author,
          doc.searchText,
          ...peopleNames,
          ...companies,
          ...locations,
          ...refs,
          source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(keyword.toLowerCase())) return false;
      }

      return true;
    });

    res.json({
      documents: filtered.slice(0, limit),
      total: filtered.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Metadata search error:", error);
    res.status(500).json({ error: "Metadata search failed" });
  }
});

export default router;
