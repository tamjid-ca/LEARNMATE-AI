# LearnMate AI

Full-stack AI-powered educational platform for personalized learning, examination preparation, spaced-repetition flashcards, document-grounded RAG tutoring, and curriculum management. Initially tailored for the Bangladesh education ecosystem (SSC, HSC, University Admission, BCS) with a multi-country extensible curriculum hierarchy.

## Architecture & Tech Stack

- **Frontend**: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons, React Hook Form, Zod, Recharts, Framer Motion
- **Backend**: Next.js Route Handlers (`/api/v1/*`) on Node.js runtime, modular Controller → Service → Repository architecture
- **Database**: MongoDB Atlas with Mongoose ODM (27 indexed collections, serverless connection pooling)
- **AI Gateway**: OpenRouter (`openrouter/free` default routing with per-task model overrides, Zod structured-output validation, quotas, and fallbacks)
- **Storage & Deployment**: Vercel + Vercel Blob (or compatible storage adapter)
- **Testing**: Vitest (unit & integration) + Playwright (end-to-end)

## Key Documentation

- [Implementation Context (`Context.md`)](./Context.md) — Current development state and session handoff
- [Software Requirements Specification (`docs/PROJECT_SRS.md`)](./docs/PROJECT_SRS.md)
- [Implementation Plan (`docs/IMPLEMENTATION_PLAN.md`)](./docs/IMPLEMENTATION_PLAN.md)
- [System Architecture (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)
- [Database Schema (`docs/DATABASE_SCHEMA.md`)](./docs/DATABASE_SCHEMA.md)
- [API Specification (`docs/API_SPECIFICATION.md`)](./docs/API_SPECIFICATION.md)
- [AI Integration (`docs/AI_INTEGRATION.md`)](./docs/AI_INTEGRATION.md)
- [Testing Strategy (`docs/TESTING_STRATEGY.md`)](./docs/TESTING_STRATEGY.md)
- [Deployment Guide (`docs/DEPLOYMENT.md`)](./docs/DEPLOYMENT.md)
- [Technical Decisions (`docs/DECISIONS.md`)](./docs/DECISIONS.md)

## Quick Start

1. Copy `.env.example` to `.env.local` and configure `MONGODB_URI`, `AUTH_SECRET`, and `OPENROUTER_API_KEY`.
2. Install dependencies and run verification scripts (scaffolded in State 02):
   ```bash
   npm install
   npm run dev
   ```
