/**
 * LearnMate AI — Mongoose Model & Schema Definition Factory
 * Generates Mongoose schema definitions and index declarations directly from
 * SCHEMA_REGISTRY so docs, tests, and runtime Mongoose models never drift.
 */

import {
  type CollectionBlueprint,
  type IndexSpec,
  SCHEMA_REGISTRY,
} from '../lib/database/schema-registry.ts';
import { COLLECTION_NAMES, type CollectionName } from '../types/domain.ts';

export interface CompiledModelSpec {
  collectionName: CollectionName;
  ownershipScope: CollectionBlueprint['ownershipScope'];
  ownerField?: string;
  sensitiveFields: string[];
  indexes: readonly IndexSpec[];
  blueprint: CollectionBlueprint;
}

export function getCompiledModelSpec(name: CollectionName): CompiledModelSpec {
  const blueprint = SCHEMA_REGISTRY[name];
  const sensitiveFields = Object.entries(blueprint.fields)
    .filter(([, spec]) => spec.sensitive === true)
    .map(([fieldName]) => fieldName);

  return {
    collectionName: name,
    ownershipScope: blueprint.ownershipScope,
    ownerField: blueprint.ownerField,
    sensitiveFields,
    indexes: blueprint.indexes,
    blueprint,
  };
}

export function getAllCompiledModelSpecs(): CompiledModelSpec[] {
  return COLLECTION_NAMES.map((name) => getCompiledModelSpec(name));
}
