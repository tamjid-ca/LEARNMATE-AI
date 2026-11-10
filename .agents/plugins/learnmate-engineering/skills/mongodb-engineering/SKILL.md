---
name: mongodb-engineering
description: >-
  Use this skill when designing Mongoose schemas, managing database connections,
  writing queries, configuring indexes, implementing pagination, or seeding data
  in LearnMate AI.
---

# MongoDB & Mongoose Engineering Skill (LearnMate AI)

## Core Guidelines

1. **Serverless Connection Management**:
   - Cache the Mongoose connection promise on `globalThis` in `src/lib/database/mongoose.ts` so warm Vercel function instances reuse connections.
   - Configure bounded `maxPoolSize` (e.g., 10) and `serverSelectionTimeoutMS`.
2. **Schema & Data Modeling**:
   - Never embed unbounded arrays (messages, attempts, flashcards, logs) inside `users` or parent documents; use referenced collections with indexed foreign keys.
   - Store uploaded file binaries in object storage (Vercel Blob / S3 adapter), keeping only metadata and storage keys in `uploadedMaterials`.
3. **Ownership & Indexing**:
   - Every student-owned collection (`conversations`, `generatedContents`, `quizzes`, `quizAttempts`, `flashcardDecks`, `flashcards`, `reviewLogs`, `studyPlans`, `studyTasks`, `uploadedMaterials`, `documentChunks`, `progressRecords`, `notifications`) must index `userId` (often compounded with `createdAt` or status fields) and filter by `userId` on every query.
4. **Safe Seeding**:
   - Seed scripts (`scripts/seed.ts`) must use idempotent upserts (`findOneAndUpdate` with `upsert: true`) and never drop or wipe production user collections.
