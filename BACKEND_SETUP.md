# Community Chronicle Backend Setup (Legacy)

## Status

The in-repo backend path is **deprecated for production**.

Production and staging Community Chronicle traffic must target the platform API (`nxt-lvl-api`) directly. Do not deploy or route user traffic through the legacy `community-chronicle/backend` server.

## Supported Runtime Architecture

```
Community Chronicle Frontend
    ↓
nxt-lvl-api
    ├─ /api/documents/*
    ├─ /api/review-queue*
    ├─ /api/org/*
    └─ /api/docs/* (storage)
```

## Required Frontend Variables

Use the canonical platform-hosted API values:

```env
VITE_API_BASE_URL=https://api.nxtlvl.app/api
VITE_PLATFORM_API_URL=https://api.nxtlvl.app
```

For local development against local platform API:

```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_PLATFORM_API_URL=http://localhost:4000
```

## Legacy Backend Scope (Local Troubleshooting Only)

The legacy backend can be used only for local debugging of old flows and should be treated as archival tooling.

- No production support
- No schema compatibility guarantees
- No stability guarantees with current Prisma/runtime contracts

If you must run it locally, isolate it from production data and expect drift.

## Production Verification Checklist

1. Confirm health on Render origin: `GET /api/health`
2. Confirm authenticated reads: `GET /api/documents`, `GET /api/review-queue`
3. Confirm uploads route to platform API only
4. Confirm no custom-domain cutover until TLS and DNS checks are green

## Related Files

- `src/lib/apiBase.ts`
- `wrangler.toml`
- `.env.example`
