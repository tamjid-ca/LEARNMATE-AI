---
name: backend-engineering
description: >-
  Use this skill when implementing Next.js Route Handlers (/api/v1/*), domain
  services, request validation, authentication/RBAC middleware, pagination, or
  error handling in LearnMate AI.
---

# Backend Engineering Skill (LearnMate AI)

## Core Guidelines

1. **Layered Architecture**:
   - **Route Handlers (`src/app/api/v1/.../route.ts`)**: Parse request, invoke auth/RBAC guard, validate input with Zod, call service, return standardized JSON response.
   - **Services (`src/services/` or `src/modules/*/service.ts`)**: Pure business logic, orchestration, ownership verification, and cross-module workflows.
   - **Repositories / Models (`src/repositories/`, `src/models/`)**: Mongoose queries, projections, pagination, and atomic updates.
2. **Standard API Envelope**:
   - Success: `{ success: true, data: T, meta?: PaginationMeta }`
   - Error: `{ success: false, error: { code: string, message: string, details?: unknown } }`
3. **Security & Trust Boundaries**:
   - Derive `userId` and `role` exclusively from the verified server session, never from request body/query headers.
   - Enforce rate limiting on authentication, AI generation, and document upload endpoints.
   - Use Node.js runtime (`export const runtime = 'nodejs'`) for routes interacting with Mongoose or file parsing.
