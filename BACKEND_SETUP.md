# Community Chronicle Backend Setup

## Overview

Community Chronicle now has a lightweight backend that:
- **Provides search functionality** with document filtering and classification
- **Proxies storage requests to nxt-lvl-api** for bucket access (community-chronicle bucket)
- **Works with optional local database** for search analytics (Postgres)

## Architecture

```
Community Chronicle Frontend
    ↓
Community Chronicle Backend (Port 5000)
    ├─ /api/documents/search → Forward to nxt-lvl-api OR query local DB
    ├─ /api/classifications → Forward to nxt-lvl-api OR query local DB
    ├─ /api/statistics → Forward to nxt-lvl-api OR query local DB
    └─ /api/documents/* → Proxy to nxt-lvl-api
    
nxt-lvl-api (Port 4000)
    └─ /api/docs/* → Document storage & R2 bucket access
```

## Installation

### 1. Install Dependencies

```bash
cd community-chronicle
npm install
```

### 2. Setup Environment

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Update `.env`:
```env
PORT=5000
NXTLVL_API_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:8080
NODE_ENV=development
```

### 3. Optional: Local Search Database

If you want search analytics stored locally:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/community_chronicle
```

Then setup Prisma:
```bash
npm run prisma:generate
npm run prisma:push
```

## Running the Backend

### Development

```bash
# Terminal 1: Community Chronicle Backend
npm run dev:backend

# Terminal 2: Community Chronicle Frontend
npm run dev

# Terminal 3: Full stack (optional)
npm run dev:full
```

### Production

```bash
npm run build:backend
npm run build
```

## API Endpoints

### Search Operations

**POST `/api/documents/search`**
- Search documents with filters
- Request: `{ q: string, organizationId: string, classification?: string, status?: string }`
- Returns: `{ documents: [], total: number, executionMs: number }`

**GET `/api/classifications?organizationId=:id`**
- Get available document classifications
- Returns: `[{ label: string, value: string, count: number }]`

**GET `/api/statistics?organizationId=:id`**
- Get document statistics
- Returns: `{ totalDocuments: number, byStatus: {}, byClassification: {} }`

### Document Operations (Proxied to nxt-lvl-api)

**POST `/api/documents/upload`**
- Upload a document
- Proxies to: `POST /api/docs/upload`

**GET `/api/documents/:id`**
- Get document details
- Proxies to: `GET /api/docs/:id`

**POST `/api/documents/upload/batch`**
- Batch upload documents
- Proxies to: `POST /api/docs/upload/batch`

## Database Schema (Optional)

If using local database, the schema includes:
- `Organization` - Organization records
- `User` - User records
- `Document` - Document metadata with full-text search
- `SearchLog` - Search analytics

## How It Works

### Without Local Database
- Returns requests to search endpoints without storing data
- All data comes from nxt-lvl-api

### With Local Database
- Search logs are stored locally for analytics
- Document metadata can be indexed locally for faster searches
- Requires Prisma migrations to be run

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Backend server port | `5000` |
| `NXTLVL_API_URL` | Address of nxt-lvl-api | `http://localhost:4000` |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:8080` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | Optional Postgres URL | `postgresql://...` |

## Storage Configuration

Storage is configured in **nxt-lvl-api** using the **community-chronicle** bucket:
- Provider: R2 (Cloudflare)
- Bucket: `community-chronicle`
- Path prefix: `org/{organizationId}/documents/{fileId}`

## Troubleshooting

### Backend won't start
```bash
# Check if port 5000 is available
lsof -i :5000

# Check if nxt-lvl-api is running on 4000
curl http://localhost:4000/api/health
```

### Search not working
- Ensure `NXTLVL_API_URL` points to running nxt-lvl-api
- Check browser console for CORS errors
- Verify auth token is being passed correctly

### Database issues
```bash
# Reset Prisma
npm run prisma:push -- --skip-generate
npm run prisma:generate
```

## Development

### Build TypeScript
```bash
npm run build:backend
```

### Type Checking
```bash
tsc --project tsconfig.backend.json --noEmit
```

## Next Steps

1. Set up nxt-lvl-api with community-chronicle bucket
2. Configure R2 credentials in nxt-lvl-api
3. Run migrations if using local database
4. Test search via API endpoints
5. Integrate DocumentSearch component into main app
