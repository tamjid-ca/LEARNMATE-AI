/**
 * LearnMate AI — Idempotent Custom Education Architecture Migration & Index Sync
 * Safely backfills `scope: 'global'` and `isArchived: false` on existing curriculum
 * records and replaces rigid legacy single-tenant unique indexes with scope-aware indexes.
 */

import { connectToDatabase } from '../mongoose.ts';
import { getMongooseModel } from '../../../models/index.ts';
import type { CollectionName } from '../../../types/domain.ts';

export interface CustomEducationMigrationResult {
  dryRun: boolean;
  inspectedCounts: Record<string, number>;
  updatedCounts: Record<string, number>;
  droppedLegacyIndexes: string[];
  syncedCollections: string[];
}

const CURRICULUM_COLLECTIONS: readonly CollectionName[] = [
  'educationSystems',
  'educationLevels',
  'examinations',
  'subjects',
  'chapters',
  'topics',
];

const LEGACY_INDEX_NAMES: Record<string, readonly string[]> = {
  educationSystems: ['code_1'],
  educationLevels: ['educationSystemId_1_code_1'],
  examinations: ['educationLevelId_1_code_1'],
  subjects: ['educationLevelId_1_code_1'],
};

/**
 * Pure idempotent backfill helper usable in automated tests on plain collections/records.
 */
export function backfillCustomEducationDefaults<T extends Record<string, unknown>>(
  records: T[],
  options: { isEducationSystem?: boolean } = {},
): { updatedCount: number; records: T[] } {
  let updatedCount = 0;
  const next = records.map((rec) => {
    let changed = false;
    const copy: Record<string, unknown> = { ...rec };
    if (copy.scope === undefined || copy.scope === null) {
      copy.scope = 'global';
      changed = true;
    }
    if (copy.isArchived === undefined || copy.isArchived === null) {
      copy.isArchived = false;
      changed = true;
    }
    if (options.isEducationSystem && !copy.educationType) {
      copy.educationType = copy.scope === 'custom' ? 'custom' : 'standard';
      changed = true;
    }
    if (changed) updatedCount += 1;
    return copy as T;
  });

  return { updatedCount, records: next };
}

export async function runCustomEducationMigration(
  options: { dryRun?: boolean } = {},
): Promise<CustomEducationMigrationResult> {
  const dryRun = Boolean(options.dryRun);
  await connectToDatabase();

  const inspectedCounts: Record<string, number> = {};
  const updatedCounts: Record<string, number> = {};
  const droppedLegacyIndexes: string[] = [];
  const syncedCollections: string[] = [];

  for (const name of CURRICULUM_COLLECTIONS) {
    const Model = getMongooseModel(name);
    const total = await Model.countDocuments({});
    inspectedCounts[name] = total;

    const filter =
      name === 'educationSystems'
        ? {
            $or: [
              { scope: { $exists: false } },
              { isArchived: { $exists: false } },
              { educationType: { $exists: false } },
            ],
          }
        : {
            $or: [{ scope: { $exists: false } }, { isArchived: { $exists: false } }],
          };

    if (dryRun) {
      updatedCounts[name] = await Model.countDocuments(filter);
    } else {
      let modified = 0;
      const resScope = await Model.updateMany(
        { scope: { $exists: false } },
        { $set: { scope: 'global' } },
      );
      modified += resScope.modifiedCount;

      const resArch = await Model.updateMany(
        { isArchived: { $exists: false } },
        { $set: { isArchived: false } },
      );
      modified += resArch.modifiedCount;

      if (name === 'educationSystems') {
        const resType = await Model.updateMany(
          { educationType: { $exists: false } },
          { $set: { educationType: 'standard' } },
        );
        modified += resType.modifiedCount;
      }
      updatedCounts[name] = modified;
    }

    const legacyNames = LEGACY_INDEX_NAMES[name] ?? [];
    if (!dryRun && legacyNames.length > 0) {
      const existingIndexes = await Model.collection.indexes();
      for (const idx of existingIndexes) {
        if (idx.name && legacyNames.includes(idx.name)) {
          await Model.collection.dropIndex(idx.name);
          droppedLegacyIndexes.push(`${name}.${idx.name}`);
        }
      }
    }

    if (!dryRun) {
      await Model.syncIndexes();
      syncedCollections.push(name);
    }
  }

  if (!dryRun) {
    const LabelModel = getMongooseModel('educationLabelConfigs');
    await LabelModel.syncIndexes();
    syncedCollections.push('educationLabelConfigs');
  }

  return {
    dryRun,
    inspectedCounts,
    updatedCounts,
    droppedLegacyIndexes,
    syncedCollections,
  };
}
