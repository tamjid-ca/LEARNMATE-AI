/**
 * LearnMate AI — Mongoose Model & Schema Definition Factory
 * Generates Mongoose schema definitions and runtime Mongoose models directly from
 * SCHEMA_REGISTRY so docs, tests, and runtime Mongoose models never drift.
 */

import mongoose, { Schema, type Model } from 'mongoose';
import {
  type CollectionBlueprint,
  type FieldType,
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

function mapFieldTypeToMongoose(type: FieldType): unknown {
  switch (type) {
    case 'ObjectId':
      return Schema.Types.ObjectId;
    case 'String':
      return String;
    case 'Number':
      return Number;
    case 'Boolean':
      return Boolean;
    case 'Date':
      return Date;
    case 'StringArray':
      return [String];
    case 'NumberArray':
      return [Number];
    case 'ObjectIdArray':
      return [Schema.Types.ObjectId];
    case 'Subdocument':
    case 'Mixed':
      return Schema.Types.Mixed;
  }
}

export function createMongooseSchema(name: CollectionName): Schema {
  const blueprint = SCHEMA_REGISTRY[name];
  const definition: Record<string, Record<string, unknown>> = {};

  for (const [fieldName, spec] of Object.entries(blueprint.fields)) {
    const fieldDef: Record<string, unknown> = {
      type: mapFieldTypeToMongoose(spec.type),
    };
    if (spec.required) fieldDef.required = true;
    if (spec.ref) fieldDef.ref = spec.ref;
    if (spec.enumValues && spec.type === 'String') fieldDef.enum = [...spec.enumValues];
    if (spec.defaultValue !== undefined) fieldDef.default = spec.defaultValue;
    if (spec.sensitive) fieldDef.select = false;

    definition[fieldName] = fieldDef;
  }

  const schema = new Schema(definition, {
    collection: blueprint.name,
    timestamps: blueprint.timestamps,
  });

  for (const idx of blueprint.indexes) {
    schema.index(idx.fields, {
      ...(idx.unique ? { unique: true } : {}),
      ...(idx.sparse ? { sparse: true } : {}),
    });
  }

  return schema;
}

export function getMongooseModel<T = Record<string, unknown>>(name: CollectionName): Model<T> {
  const existing = mongoose.models[name] as Model<T> | undefined;
  if (existing) {
    return existing;
  }
  const schema = createMongooseSchema(name);
  return mongoose.model<T>(name, schema);
}
