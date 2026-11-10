---
name: frontend-engineering
description: >-
  Use this skill when building or modifying Next.js App Router pages, layouts,
  shadcn/ui components, forms, charts, responsive navigation, dark/light themes,
  or Bangla/English localization in LearnMate AI.
---

# Frontend Engineering Skill (LearnMate AI)

## Core Guidelines

1. **Next.js App Router**:
   - Default to React Server Components (RSC) for data fetching and page shells.
   - Add `'use client'` only at leaf interactive boundaries (forms, chat stream UI, timers, flashcard flip, charts).
2. **Component Architecture**:
   - Compose UI from `src/components/ui/` (shadcn/ui primitives) into `src/components/shared/` and `src/components/features/`.
   - Do not replace standard shadcn/ui primitives (Dialog, Sheet, Tabs, Select, Table, Card, Tooltip, Form) with custom ad-hoc markup.
3. **Forms & Validation**:
   - Use `react-hook-form` with `@hookform/resolvers/zod` and shared schemas from `src/lib/validators/`.
4. **UX States & Accessibility**:
   - Every data-driven view must provide skeleton loading, empty state with clear CTA, and actionable error recovery.
   - Maintain WCAG AA contrast in both Light and Dark themes, semantic HTML landmarks, and keyboard focus management.
   - Ensure proper font rendering and layout resilience for both English and Bangla (`bn`) Unicode text.
