export declare class ObjectId {
  constructor(id?: string | ObjectId);
  toString(): string;
  equals(other: string | ObjectId): boolean;
  static isValid(id: unknown): boolean;
}

export declare namespace Types {
  export { ObjectId };
}

export interface SchemaPathOptions {
  type?: unknown;
  required?: boolean;
  unique?: boolean;
  ref?: string;
  enum?: readonly string[];
  default?: unknown;
  select?: boolean;
}

export interface SchemaTypePath {
  options: SchemaPathOptions;
}

export interface SchemaOptions {
  collection?: string;
  timestamps?: boolean;
}

export declare class Schema<T = Record<string, unknown>> {
  static Types: {
    ObjectId: typeof ObjectId;
    Mixed: unknown;
  };
  constructor(definition: Record<string, unknown>, options?: SchemaOptions);
  index(
    fields: Record<string, 1 | -1 | 'text'>,
    options?: { unique?: boolean; sparse?: boolean },
  ): this;
  get(key: 'collection' | 'timestamps' | string): unknown;
  indexes(): Array<[Record<string, 1 | -1 | 'text'>, Record<string, unknown>]>;
  path(name: string): SchemaTypePath | undefined;
}

export interface QueryExec<R> extends Promise<R> {
  select(fields: string | Record<string, 0 | 1>): QueryExec<R>;
  sort(fields: Record<string, 1 | -1>): QueryExec<R>;
  skip(n: number): QueryExec<R>;
  limit(n: number): QueryExec<R>;
  lean<L = R>(): Promise<L>;
  exec(): Promise<R>;
}

export interface Model<T = Record<string, unknown>> {
  modelName: string;
  collection: { name: string };
  schema: Schema<T>;
  create(doc: Partial<T> | Array<Partial<T>>): Promise<T>;
  find(filter?: Record<string, unknown>): QueryExec<T[]>;
  findOne(filter?: Record<string, unknown>): QueryExec<T | null>;
  findById(id: string | ObjectId): QueryExec<T | null>;
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: { new?: boolean; upsert?: boolean },
  ): QueryExec<T | null>;
  findByIdAndUpdate(
    id: string | ObjectId,
    update: Record<string, unknown>,
    options?: { new?: boolean; upsert?: boolean },
  ): QueryExec<T | null>;
  deleteOne(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
  deleteMany(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
  countDocuments(filter?: Record<string, unknown>): Promise<number>;
  syncIndexes(): Promise<string[]>;
}

export interface ConnectOptions {
  maxPoolSize?: number;
  minPoolSize?: number;
  serverSelectionTimeoutMS?: number;
  socketTimeoutMS?: number;
  bufferCommands?: boolean;
}

export interface Connection {
  readyState: number;
}

export interface MongooseInstance {
  Schema: typeof Schema;
  Types: typeof Types;
  connection: Connection;
  models: Record<string, Model<unknown> | undefined>;
  connect: typeof connect;
  disconnect: typeof disconnect;
  model: typeof model;
}

export declare const connection: Connection;
export declare const models: Record<string, Model<unknown> | undefined>;

export declare function connect(uri: string, options?: ConnectOptions): Promise<MongooseInstance>;
export declare function disconnect(): Promise<void>;
export declare function model<T = Record<string, unknown>>(
  name: string,
  schema?: Schema<T>,
): Model<T>;

declare const mongooseDefault: MongooseInstance;
export default mongooseDefault;
