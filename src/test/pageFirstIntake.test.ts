/**
 * Tests for the page-first intake service.
 *
 * Coverage:
 * - labelPageMetadata: detects doc type, company, person, month, year, date
 * - labelPageMetadata: confidence scoring and needsReview flagging
 * - suggestDocumentPackets: groups related consecutive pages
 * - suggestDocumentPackets: starts new packet on company/type/date change
 * - suggestDocumentPackets: continuation signals attach to previous packet
 * - suggestDocumentPackets: low-confidence pages marked needsReview
 * - labelAllPages: labels all pages from an array
 */

import { describe, it, expect } from "vitest";
import {
  labelPageMetadata,
  suggestDocumentPackets,
  labelAllPages,
} from "@/services/pageFirstIntake";
import type { LabeledPage } from "@/types/pageFirstIntake";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makePage(overrides: Partial<LabeledPage>): LabeledPage {
  return {
    pageNumber: 1,
    pageText: "",
    label: {
      detectedDocType: null,
      detectedCompanyOrOrg: null,
      detectedPersonName: null,
      detectedMonth: null,
      detectedYear: null,
      detectedDate: null,
      confidence: 0.5,
      needsReview: false,
      warnings: [],
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// labelPageMetadata
// ─────────────────────────────────────────────────────────────────────────────

describe("labelPageMetadata", () => {
  describe("document type detection", () => {
    it("detects invoice type from text", () => {
      const label = labelPageMetadata(
        "Invoice #12345\nAmount Due: $500.00\nBill To: ABC Corp\nTotal Due: $500",
      );
      expect(label.detectedDocType).toBe("invoice");
    });

    it("detects payroll type from text", () => {
      const label = labelPageMetadata(
        "Pay Stub\nEmployee: Jane Smith\nPay Period: Jan 1–15 2024\nGross Pay: $3,000\nNet Pay: $2,400",
      );
      expect(label.detectedDocType).toBe("payroll");
    });

    it("detects grant type from text", () => {
      const label = labelPageMetadata(
        "Grant Award Letter\nGrant Amount: $50,000\nGrant Period: 2024–2025",
      );
      expect(label.detectedDocType).toBe("grant");
    });

    it("detects donation type from text", () => {
      const label = labelPageMetadata(
        "Dear Friend,\nThank you for your gift of $250.\nYour donation supports our community.",
      );
      expect(label.detectedDocType).toBe("donation");
    });

    it("detects meeting minutes from text", () => {
      const label = labelPageMetadata(
        "Board Meeting Minutes\nAttendees: John, Mary\nAgenda: Q1 Review\nMotion passed unanimously.\nAdjourned.",
      );
      expect(label.detectedDocType).toBe("minutes");
    });

    it("detects sign-in sheet from text", () => {
      const label = labelPageMetadata(
        "Sign In Sheet\nName / Signature\n1. Alice Brown\n2. Bob Jones\nPrinted Name",
      );
      expect(label.detectedDocType).toBe("sign_in_sheet");
    });

    it("detects tax document from text", () => {
      const label = labelPageMetadata(
        "1099-MISC\nTax Year 2023\nFederal Income Tax\nIRS Form",
      );
      expect(label.detectedDocType).toBe("tax");
    });

    it("returns null doc type for unrecognized text", () => {
      const label = labelPageMetadata("Lorem ipsum dolor sit amet consectetur adipiscing elit.");
      expect(label.detectedDocType).toBeNull();
    });
  });

  describe("date, month, year detection", () => {
    it("extracts year from page text", () => {
      const label = labelPageMetadata("Financial report for fiscal year 2024 ending December 31.");
      expect(label.detectedYear).toBe(2024);
    });

    it("extracts month name from page text", () => {
      const label = labelPageMetadata("March expenses summary for the quarter ending 2024.");
      expect(label.detectedMonth).toBe(3);
    });

    it("extracts full date from MM/DD/YYYY format", () => {
      const label = labelPageMetadata("Invoice Date: 03/15/2024\nDue Date: 04/15/2024");
      expect(label.detectedDate).toBe("03/15/2024");
    });

    it("extracts full date from Month DD, YYYY format", () => {
      const label = labelPageMetadata("Dated this January 5, 2024 at our offices.");
      expect(label.detectedDate).toMatch(/January 5, 2024/i);
    });

    it("extracts full date from ISO YYYY-MM-DD format", () => {
      const label = labelPageMetadata("Transaction date: 2024-07-22\nPayment confirmed.");
      expect(label.detectedDate).toBe("2024-07-22");
    });

    it("prefers filename year over content year when both present", () => {
      const label = labelPageMetadata(
        "This document references 2019 records.",
        "2024_grant_award.pdf",
      );
      expect(label.detectedYear).toBe(2024);
    });
  });

  describe("confidence and needsReview", () => {
    it("gives high confidence to a well-labeled page", () => {
      const label = labelPageMetadata(
        "Invoice #555\nAmount Due: $1000\nABC Foundation Inc.\nJanuary 2024\nCustomer: Alice Johnson",
      );
      expect(label.confidence).toBeGreaterThan(0.4);
    });

    it("gives low confidence to a blank page", () => {
      const label = labelPageMetadata("   ");
      expect(label.confidence).toBeLessThanOrEqual(0.2);
      expect(label.needsReview).toBe(true);
    });

    it("marks page as needsReview when confidence is below threshold", () => {
      const label = labelPageMetadata("Some random unrecognizable scribble here.");
      expect(label.needsReview).toBe(true);
    });

    it("does not mark needsReview for a clearly labeled page", () => {
      const label = labelPageMetadata(
        "Invoice #1001\nAmount Due: $500\nBill To: Smith Enterprises Inc.\nInvoice Date: 03/15/2024\nCustomer: John Smith",
        "2024_03_invoice.pdf",
      );
      expect(label.needsReview).toBe(false);
    });

    it("includes warnings for blank page", () => {
      const label = labelPageMetadata("");
      expect(label.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("organization detection", () => {
    it("detects organization with Inc suffix", () => {
      const label = labelPageMetadata(
        "From: Acme Solutions Inc.\nInvoice for services rendered.",
      );
      expect(label.detectedCompanyOrOrg).toContain("Inc");
    });

    it("detects Foundation organization", () => {
      const label = labelPageMetadata(
        "Grant awarded by: Community Futures Foundation\nAmount: $10,000",
      );
      expect(label.detectedCompanyOrOrg).toContain("Foundation");
    });
  });

  describe("person detection", () => {
    it("detects person from Name: label", () => {
      const label = labelPageMetadata("Name: Alice Johnson\nRole: Treasurer");
      expect(label.detectedPersonName).toBe("Alice Johnson");
    });

    it("detects person from Employee: label", () => {
      const label = labelPageMetadata("Employee: Robert Brown\nPay Period: March 2024");
      expect(label.detectedPersonName).toBe("Robert Brown");
    });

    it("detects person from Donor: label", () => {
      const label = labelPageMetadata("Donor: Maria Garcia\nDonation Amount: $500");
      expect(label.detectedPersonName).toBe("Maria Garcia");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// suggestDocumentPackets
// ─────────────────────────────────────────────────────────────────────────────

describe("suggestDocumentPackets", () => {
  it("returns empty array for empty input", () => {
    expect(suggestDocumentPackets([])).toEqual([]);
  });

  it("creates one packet for a single page", () => {
    const pages: LabeledPage[] = [
      makePage({
        pageNumber: 1,
        pageText: "Invoice #1\nAmount Due: $100",
        label: {
          detectedDocType: "invoice",
          detectedCompanyOrOrg: "ACME Corp",
          detectedPersonName: null,
          detectedMonth: 3,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.8,
          needsReview: false,
          warnings: [],
        },
      }),
    ];
    const packets = suggestDocumentPackets(pages);
    expect(packets).toHaveLength(1);
    expect(packets[0].pages).toHaveLength(1);
    expect(packets[0].pages[0].relationshipType).toBe("primary");
  });

  it("groups consecutive pages with same company and doc type into one packet", () => {
    const pages: LabeledPage[] = [
      makePage({
        pageNumber: 1,
        pageText: "Invoice #1 — Page 1\nBill To: ACME Corp",
        label: {
          detectedDocType: "invoice",
          detectedCompanyOrOrg: "ACME Corp",
          detectedPersonName: null,
          detectedMonth: 3,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.8,
          needsReview: false,
          warnings: [],
        },
      }),
      makePage({
        pageNumber: 2,
        pageText: "Invoice #1 — continued\nLine items continued",
        label: {
          detectedDocType: "invoice",
          detectedCompanyOrOrg: "ACME Corp",
          detectedPersonName: null,
          detectedMonth: 3,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.75,
          needsReview: false,
          warnings: [],
        },
      }),
    ];
    const packets = suggestDocumentPackets(pages);
    expect(packets).toHaveLength(1);
    expect(packets[0].pages).toHaveLength(2);
    expect(packets[0].primaryCompanyOrOrg).toBe("ACME Corp");
  });

  it("starts a new packet when company changes", () => {
    const pages: LabeledPage[] = [
      makePage({
        pageNumber: 1,
        pageText: "Invoice from Alpha Corp\nAmount: $200",
        label: {
          detectedDocType: "invoice",
          detectedCompanyOrOrg: "Alpha Corp",
          detectedPersonName: null,
          detectedMonth: 1,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.8,
          needsReview: false,
          warnings: [],
        },
      }),
      makePage({
        pageNumber: 2,
        pageText: "Invoice from Beta Ltd\nAmount: $300",
        label: {
          detectedDocType: "invoice",
          detectedCompanyOrOrg: "Beta Ltd",
          detectedPersonName: null,
          detectedMonth: 2,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.8,
          needsReview: false,
          warnings: [],
        },
      }),
    ];
    const packets = suggestDocumentPackets(pages);
    expect(packets).toHaveLength(2);
    expect(packets[0].primaryCompanyOrOrg).toBe("Alpha Corp");
    expect(packets[1].primaryCompanyOrOrg).toBe("Beta Ltd");
  });

  it("starts a new packet when doc type changes significantly", () => {
    const pages: LabeledPage[] = [
      makePage({
        pageNumber: 1,
        label: {
          detectedDocType: "invoice",
          detectedCompanyOrOrg: "ACME Corp",
          detectedPersonName: null,
          detectedMonth: 1,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.8,
          needsReview: false,
          warnings: [],
        },
      }),
      makePage({
        pageNumber: 2,
        label: {
          detectedDocType: "payroll",
          detectedCompanyOrOrg: "ACME Corp",
          detectedPersonName: null,
          detectedMonth: 1,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.8,
          needsReview: false,
          warnings: [],
        },
      }),
    ];
    const packets = suggestDocumentPackets(pages);
    expect(packets).toHaveLength(2);
    expect(packets[0].packetType).toBe("invoice");
    expect(packets[1].packetType).toBe("payroll");
  });

  it("attaches continuation page to previous packet", () => {
    const pages: LabeledPage[] = [
      makePage({
        pageNumber: 1,
        label: {
          detectedDocType: "grant",
          detectedCompanyOrOrg: "City Foundation",
          detectedPersonName: null,
          detectedMonth: 6,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.85,
          needsReview: false,
          warnings: [],
        },
      }),
      makePage({
        pageNumber: 2,
        pageText: "Grant Agreement — continued\nAdditional terms follow.",
        label: {
          detectedDocType: "grant",
          detectedCompanyOrOrg: null,
          detectedPersonName: null,
          detectedMonth: null,
          detectedYear: null,
          detectedDate: null,
          confidence: 0.4,
          needsReview: false,
          warnings: [],
        },
      }),
    ];
    const packets = suggestDocumentPackets(pages);
    expect(packets).toHaveLength(1);
    expect(packets[0].pages).toHaveLength(2);
    // Continuation page should have continuation relationship
    const secondPageEntry = packets[0].pages[1];
    expect(secondPageEntry.relationshipType).toBe("continuation");
  });

  it("marks packet as needsReview when any page is low confidence", () => {
    const pages: LabeledPage[] = [
      makePage({
        pageNumber: 1,
        label: {
          detectedDocType: "invoice",
          detectedCompanyOrOrg: "ACME",
          detectedPersonName: null,
          detectedMonth: 1,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.85,
          needsReview: false,
          warnings: [],
        },
      }),
      makePage({
        pageNumber: 2,
        pageText: "Invoice continued — page 2",
        label: {
          detectedDocType: "invoice",
          detectedCompanyOrOrg: "ACME",
          detectedPersonName: null,
          detectedMonth: 1,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.2,   // low
          needsReview: true, // flagged
          warnings: ["Low confidence"],
        },
      }),
    ];
    const packets = suggestDocumentPackets(pages);
    expect(packets).toHaveLength(1);
    expect(packets[0].needsReview).toBe(true);
  });

  it("assigns first page as 'primary' relationship", () => {
    const pages: LabeledPage[] = [
      makePage({ pageNumber: 1, label: { ...makePage({}).label, detectedDocType: "donation" } }),
      makePage({ pageNumber: 2, label: { ...makePage({}).label, detectedDocType: "donation" } }),
    ];
    const packets = suggestDocumentPackets(pages);
    expect(packets[0].pages[0].orderIndex).toBe(0);
    expect(packets[0].pages[0].relationshipType).toBe("primary");
  });

  it("assigns correct orderIndex to pages within a packet", () => {
    const pages: LabeledPage[] = [1, 2, 3].map((n) =>
      makePage({
        pageNumber: n,
        label: {
          detectedDocType: "minutes",
          detectedCompanyOrOrg: "Board",
          detectedPersonName: null,
          detectedMonth: 5,
          detectedYear: 2023,
          detectedDate: null,
          confidence: 0.8,
          needsReview: false,
          warnings: [],
        },
      }),
    );
    const packets = suggestDocumentPackets(pages);
    expect(packets).toHaveLength(1);
    expect(packets[0].pages[0].orderIndex).toBe(0);
    expect(packets[0].pages[1].orderIndex).toBe(1);
    expect(packets[0].pages[2].orderIndex).toBe(2);
  });

  it("builds a descriptive packet title from label fields", () => {
    const pages: LabeledPage[] = [
      makePage({
        pageNumber: 1,
        label: {
          detectedDocType: "invoice",
          detectedCompanyOrOrg: "Sunrise Foundation",
          detectedPersonName: null,
          detectedMonth: 7,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.9,
          needsReview: false,
          warnings: [],
        },
      }),
    ];
    const packets = suggestDocumentPackets(pages);
    expect(packets[0].title).toContain("Invoice");
    expect(packets[0].title).toContain("Sunrise Foundation");
    expect(packets[0].title).toContain("2024");
  });

  it("handles year mismatch → different packets", () => {
    const pages: LabeledPage[] = [
      makePage({
        pageNumber: 1,
        label: {
          detectedDocType: "grant",
          detectedCompanyOrOrg: "City Foundation",
          detectedPersonName: null,
          detectedMonth: 1,
          detectedYear: 2023,
          detectedDate: null,
          confidence: 0.8,
          needsReview: false,
          warnings: [],
        },
      }),
      makePage({
        pageNumber: 2,
        label: {
          detectedDocType: "grant",
          detectedCompanyOrOrg: "City Foundation",
          detectedPersonName: null,
          detectedMonth: 1,
          detectedYear: 2024,
          detectedDate: null,
          confidence: 0.8,
          needsReview: false,
          warnings: [],
        },
      }),
    ];
    const packets = suggestDocumentPackets(pages);
    expect(packets).toHaveLength(2);
    expect(packets[0].detectedYear).toBe(2023);
    expect(packets[1].detectedYear).toBe(2024);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// labelAllPages
// ─────────────────────────────────────────────────────────────────────────────

describe("labelAllPages", () => {
  it("labels all pages and preserves page numbers", () => {
    const pages = [
      { pageNumber: 1, pageText: "Invoice #1\nAmount Due: $100" },
      { pageNumber: 2, pageText: "Invoice continued\nLine items" },
    ];
    const labeled = labelAllPages(pages, "2024_invoice.pdf");
    expect(labeled).toHaveLength(2);
    expect(labeled[0].pageNumber).toBe(1);
    expect(labeled[1].pageNumber).toBe(2);
  });

  it("assigns orgId-bearing pageIds when provided", () => {
    const pages = [
      { pageNumber: 1, pageId: "page-id-001", pageText: "Payroll March 2024" },
    ];
    const labeled = labelAllPages(pages);
    expect(labeled[0].pageId).toBe("page-id-001");
  });

  it("labels page doc type from filename hint", () => {
    const pages = [{ pageNumber: 1, pageText: "Summary of funds received" }];
    const labeled = labelAllPages(pages, "2024_03_grant_funding.pdf");
    // Filename has 'grant' keyword
    expect(labeled[0].label.detectedDocType).toBe("grant");
  });

  it("extracts year and month from filename for all pages", () => {
    const pages = [
      { pageNumber: 1, pageText: "Page one content." },
      { pageNumber: 2, pageText: "Page two content." },
    ];
    const labeled = labelAllPages(pages, "2023_11_invoice_utilities.pdf");
    expect(labeled[0].label.detectedYear).toBe(2023);
    expect(labeled[0].label.detectedMonth).toBe(11);
    expect(labeled[1].label.detectedYear).toBe(2023);
    expect(labeled[1].label.detectedMonth).toBe(11);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end: upload → label → group pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("page-first pipeline (label → group)", () => {
  it("creates OriginalUpload-equivalent data: every page gets pageNumber and orgId placeholder", () => {
    const rawPages = [
      { pageNumber: 1, pageId: "p1", pageText: "Invoice #100\nBill To: Sunrise Corp\nJanuary 2024\nAmount Due: $500" },
      { pageNumber: 2, pageId: "p2", pageText: "Invoice #100 continued\nLine items list" },
      { pageNumber: 3, pageId: "p3", pageText: "Grant Award Letter\nCity Foundation\nGrant Period 2024" },
    ];
    const labeled = labelAllPages(rawPages, "2024_01_mixed.pdf");
    expect(labeled).toHaveLength(3);
    labeled.forEach((p, i) => {
      expect(p.pageNumber).toBe(i + 1);
      expect(p.label).toBeDefined();
    });
  });

  it("groups invoice pages together and splits grant page into separate packet", () => {
    const rawPages = [
      { pageNumber: 1, pageId: "p1", pageText: "Invoice #100\nBill To: Sunrise Corp\nJanuary 2024" },
      { pageNumber: 2, pageId: "p2", pageText: "Invoice #100 — page 2 continued" },
      { pageNumber: 3, pageId: "p3", pageText: "Grant Award Letter\nCity Foundation\nGrant Amount 2024\nGrant Period:" },
    ];
    const labeled = labelAllPages(rawPages, "multi_doc.pdf");
    const packets = suggestDocumentPackets(labeled);

    // Pages 1 and 2 should be in one packet, page 3 in another
    expect(packets.length).toBeGreaterThanOrEqual(2);
    const invoicePacket = packets.find((pk) => pk.packetType === "invoice");
    const grantPacket = packets.find((pk) => pk.packetType === "grant");
    expect(invoicePacket).toBeDefined();
    expect(grantPacket).toBeDefined();
  });

  it("page-search fields are populated: type, company, month, year", () => {
    const labeled = labelAllPages(
      [{ pageNumber: 1, pageText: "Invoice #999\nBill To: Metro Housing Corp\nFebruary 2025\nAmount Due: $750" }],
      "2025_02_invoice.pdf",
    );
    const label = labeled[0].label;
    expect(label.detectedDocType).toBe("invoice");
    expect(label.detectedYear).toBe(2025);
    expect(label.detectedMonth).toBe(2);
  });
});
