import { describe, expect, it } from 'vitest';
import {
  ADMIN_NAV_ITEMS,
  STUDENT_NAV_ITEMS,
  findNavItemByPath,
} from '../src/config/navigation.ts';
import { COLLECTION_NAMES } from '../src/types/domain.ts';
import { createMongooseSchema, getMongooseModel } from '../src/models/index.ts';
import { cn } from '../src/lib/utils.ts';

describe('State 02 — Project Scaffold, Design System & Navigation', () => {
  it('implements all 11 Student and 13 Administrator navigation routes with English & Bangla labels', () => {
    expect(STUDENT_NAV_ITEMS.length).toBe(11);
    expect(ADMIN_NAV_ITEMS.length).toBe(13);

    const seenHrefs = new Set<string>();
    for (const item of [...STUDENT_NAV_ITEMS, ...ADMIN_NAV_ITEMS]) {
      expect(item.href.startsWith('/')).toBe(true);
      expect(seenHrefs.has(item.href)).toBe(false);
      seenHrefs.add(item.href);

      expect(item.labelEn.length).toBeGreaterThan(1);
      expect(item.labelBn.length).toBeGreaterThan(1);
      expect(item.descriptionEn.length).toBeGreaterThan(5);
      expect(item.descriptionBn.length).toBeGreaterThan(5);
    }

    expect(findNavItemByPath('/tutor')?.key).toBe('tutor');
    expect(findNavItemByPath('/admin/ai-config')?.key).toBe('admin-ai-config');
    expect(findNavItemByPath('/quizzes/attempt-123')?.key).toBe('quizzes');
  });

  it('compiles all 27 collections into valid Mongoose schemas with select:false on sensitive fields', () => {
    for (const name of COLLECTION_NAMES) {
      const schema = createMongooseSchema(name);
      expect(schema.get('collection')).toBe(name);
      expect(schema.get('timestamps')).toBe(true);
      expect(schema.indexes().length).toBeGreaterThanOrEqual(1);

      const model = getMongooseModel(name);
      expect(model.modelName).toBe(name);
    }

    const userSchema = createMongooseSchema('users');
    expect(userSchema.path('passwordHash')?.options.select).toBe(false);

    const questionSchema = createMongooseSchema('questions');
    expect(questionSchema.path('correctOptionIds')?.options.select).toBe(false);
    expect(questionSchema.path('expectedShortAnswerRubric')?.options.select).toBe(false);
    expect(questionSchema.path('explanation')?.options.select).toBe(false);
  });

  it('merges Tailwind utility classes deterministically via cn()', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});
