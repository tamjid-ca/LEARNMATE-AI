# LearnMate AI — Deployment & Operations Guide

## 1. Target Infrastructure

- **Hosting & Compute**: Vercel (Next.js App Router on Node.js serverless runtime)
- **Database**: MongoDB Atlas (M0/M10+ replica set with connection pooling)
- **AI Gateway**: OpenRouter (`https://openrouter.ai/api/v1`)
- **Object Storage**: Vercel Blob (or S3-compatible adapter via `StorageAdapter`)

## 2. Environment Variables

All required and optional environment variables are documented in [`.env.example`](../.env.example):

| Variable | Scope | Required | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Server/Build | Yes | `development`, `test`, or `production` |
| `NEXT_PUBLIC_APP_URL` | Public | Yes | Canonical base URL of the deployment |
| `MONGODB_URI` | Server-only | Yes | MongoDB Atlas connection string |
| `AUTH_SECRET` | Server-only | Yes | Minimum 32-byte secret for signing sessions/JWTs |
| `OPENROUTER_API_KEY` | Server-only | Yes (for AI) | OpenRouter API authentication key |
| `OPENROUTER_BASE_URL` | Server-only | Yes | Defaults to `https://openrouter.ai/api/v1` |
| `OPENROUTER_DEFAULT_MODEL` | Server-only | Yes | Defaults to `openrouter/free` |
| `OPENROUTER_SITE_URL` | Server-only | No | HTTP-Referer header for OpenRouter rankings/analytics |
| `OPENROUTER_APP_NAME` | Server-only | No | X-Title header (`LearnMate AI`) |
| `BLOB_READ_WRITE_TOKEN` | Server-only | Prod Upload | Vercel Blob token (falls back to local storage in dev) |
| `CRON_SECRET` | Server-only | Prod Jobs | Secret header verifying scheduled background job invocations |
| `LOG_LEVEL` | Server-only | No | `debug`, `info`, `warn`, `error` |

## 3. Serverless & Production Safeguards

1. **Connection Pooling**: Reuse cached Mongoose connections across warm function instances (`maxPoolSize: 10`).
2. **Secret Isolation**: Never expose `OPENROUTER_API_KEY`, `MONGODB_URI`, or `AUTH_SECRET` in client code or `NEXT_PUBLIC_*` variables.
3. **Database Indexes & Seeding**: Run `npm run db:indexes` and `npm run db:seed` against staging/production safely (idempotent upserts only; never drop user collections).
4. **Approval Gate**: Production deployments (`State 13`) require explicit user authorization.
