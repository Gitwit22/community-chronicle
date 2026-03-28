# Community Chronicle

Community Chronicle is a document archive prototype for civil rights and equity-focused organizations. It supports searchable document intake, basic workflow tracking, review queue management, and dashboard-level operational visibility.

## What the app does

- Ingests documents through upload and manual entry flows.
- Persists records in Postgres through an Express API.
- Stores uploaded files durably on disk for MVP (`uploads/`).
- Supports faceted search, keyword relevance ranking, and timeline browsing.
- Tracks processing state, review-required flags, and operational metrics for the archive.
- Provides an administrative dashboard and review queue for triage workflows.

## Current architecture

The app now runs as a frontend + backend split:

- Frontend (`Vite + React + TypeScript`)
  - `src/pages`: route-level screens (`Index`, `NotFound`).
  - `src/components`: UI composition for archive workflows.
  - `src/hooks/useDocuments.ts`: React Query hooks now call backend API endpoints.
  - `src/services/apiDocuments.ts`: frontend API client for document/review/upload operations.

- Backend (`Node + Express + Prisma + Postgres`)
  - `server/src/app.ts`: REST API routes for documents, uploads, retries, and review actions.
  - `server/src/processingQueue.ts`: DB-backed queue worker for server-side processing state.
  - `server/src/seed.ts`: legacy seed import on empty database.
  - `prisma/schema.prisma`: Postgres schema for `Document` and `ProcessingJob`.

- Shared/project assets
  - `uploads/`: durable file storage path for MVP.
  - `src/data`: seeded legacy documents used by backend seeding and legacy tests.
  - `src/test`: unit tests for service behavior.

## What is real vs stubbed

### Real today

- Document CRUD, filtering, and search from backend API endpoints.
- Review queue fetch/resolve/mark flows backed by Postgres state.
- Durable file storage to disk (`uploads/`) for uploaded source files.
- Server-side processing state transitions (`queued` -> `processing` -> `processed`/`failed`) via a DB-backed queue.
- Legacy seed migration into the database on first boot.
- Real extraction adapters for PDF (pdf.js), image OCR (Tesseract.js), and Office spreadsheets/documents (.xlsx/.xls/.docx) in the extraction module.
- Unit test coverage for core frontend service behavior.

### Stubbed or simulated

- AI categorization/extraction remains heuristic and local, not backed by an external model.
- Server worker extraction for PDF/image is currently conservative and should be upgraded to dedicated OCR workers/cloud OCR for production quality.
- Authentication, authorization, and multi-user role enforcement are not implemented.
- File storage is local disk for MVP (not yet NAS or cloud object storage).

## Local setup

### Prerequisites

- Node.js 20+
- npm 9+
- Postgres 14+

### Install and run

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:push
npm run dev:full
```

Open the app at `http://localhost:8080`.
The API listens at `http://localhost:4000`.

## Test commands

```bash
# Run all unit tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Lint the project
npm run lint

# Build production bundle
npm run build
```

## Roadmap

- Upgrade server extraction workers for high-accuracy OCR/PDF parsing (cloud OCR fallback + retries).
- Add user auth, role-based review permissions, and audit ownership.
- Replace local disk file storage with NAS or cloud object storage.
- Expand test suite with API integration, component tests, and end-to-end coverage.
- Add import/export tooling for archival migration workflows.

## Notes for contributors

- Seeded data in `src/data/documents.ts` is intentionally stable to support deterministic tests.
- Service-layer changes should include updates to related tests in `src/test`.
