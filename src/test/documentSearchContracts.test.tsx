import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DocumentSearchPage from "@/pages/DocumentSearch";
import {
  apiSearchDocuments,
  apiGetDocumentPreview,
} from "@/services/apiDocuments";

vi.mock("@/services/apiDocuments", () => ({
  apiSearchDocuments: vi.fn(),
  apiGetDocumentPreview: vi.fn(),
  apiGetOriginalUrl: vi.fn(),
}));

function renderSearchPage(initialPath = "/documents/search?q=justice&limit=20&offset=0") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/documents/search" element={<DocumentSearchPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Document search contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiSearchDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });

  it("calls real API search when search button is used", async () => {
    renderSearchPage();

    await waitFor(() => {
      expect(apiSearchDocuments).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText(/search documents by title/i);
    fireEvent.change(input, { target: { value: "archive" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(apiSearchDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "archive" }),
      );
    });
  });

  it("opens preview modal when a search result is clicked", async () => {
    (apiSearchDocuments as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [
        {
          id: "doc-1",
          title: "Justice Report",
          filename: "justice-report.pdf",
          documentType: "report",
          tags: ["justice"],
          entities: {
            people: [],
            organizations: [],
            locations: [],
            references: [],
          },
          uploadedAt: "2024-01-01T00:00:00.000Z",
          documentDate: "2024-01-01",
          snippet: "Civil rights archive report",
          markdownAvailable: true,
          originalAvailable: true,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    (apiGetDocumentPreview as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "doc-1",
      title: "Justice Report",
      filename: "justice-report.pdf",
      documentType: "report",
      uploadedAt: "2024-01-01T00:00:00.000Z",
      documentDate: "2024-01-01",
      previewText: "Preview body",
      previewMarkdown: "# Preview body",
      snippet: "Preview body",
      markdownAvailable: true,
      originalAvailable: true,
      truncated: false,
    });

    renderSearchPage();

    await waitFor(() => {
      expect(screen.getByText("Justice Report")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => {
      expect(apiGetDocumentPreview).toHaveBeenCalledWith("doc-1");
      expect(screen.getByText("# Preview body")).toBeInTheDocument();
    });
  });
});
