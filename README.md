# Community Chronicle Frontend

Community Chronicle is now a frontend-only application that consumes the standalone Nxt Lvl Platform API.

## Stack

- Vite
- React + TypeScript
- TanStack Query
- shadcn/ui + Tailwind

## Environment

Create a `.env` file from `.env.example` and set:

```bash
VITE_API_BASE_URL=http://localhost:4000/api
```

Use your deployed platform backend URL in non-local environments.

## Local Development

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:8080` (or next available Vite port).

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
npm run test:watch
```

## API Contract Expectations

The frontend expects these backend routes to exist on the configured API base URL:

- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`
- `POST /org/setup`
- `GET /documents`
- `GET /documents/:id`
- `GET /documents/:id/download`
- `POST /documents/manual`
- `POST /documents/upload`
- `POST /documents/upload/batch`
- `PATCH /documents/:id`
- `DELETE /documents/:id`
- `POST /documents/:id/retry`
- `GET /review-queue`
- `POST /review-queue/:id/resolve`
- `POST /review-queue/:id/mark`
