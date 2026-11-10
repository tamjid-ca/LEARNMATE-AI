---
name: security-review
description: >-
  Use this skill when auditing authentication, RBAC permissions, input
  sanitization, NoSQL injection defenses, file uploads, prompt injection
  mitigations, or secret handling in LearnMate AI.
---

# Security Review Skill (LearnMate AI)

## Security Checklist

1. **Secrets & Environment**:
   - Verify no secret (`OPENROUTER_API_KEY`, `AUTH_SECRET`, `MONGODB_URI`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`) is prefixed with `NEXT_PUBLIC_` or imported by client components.
2. **Authentication & RBAC**:
   - Confirm all `/api/v1/admin/*` endpoints verify `role === 'admin'` (or `'content_manager'` where permitted by SRS) on the server and record sensitive mutations in `auditLogs`.
   - Ensure registration never accepts a `role` field from the client payload.
3. **Data Isolation & NoSQL Injection**:
   - Validate ObjectIds (`mongoose.Types.ObjectId.isValid`) and strip or reject raw MongoDB operator objects (`$where`, `$gt`, `$ne`) in user input via Zod schemas.
   - Ensure quiz delivery endpoints strip `correctAnswer` and `explanation` until an attempt is submitted or immediate-feedback mode is explicitly active.
4. **File Upload & Prompt Injection**:
   - Validate MIME type, file extension (`.pdf`, `.txt`, `.docx`), and byte size before storage.
   - Sanitize rendered Markdown/HTML and isolate untrusted document text in RAG prompts.
