/**
 * LearnMate AI — User Repository (MongoDB/Mongoose + Testable Adapter)
 * Enforces email uniqueness, passwordHash projection safety, and cascading personal data deletion.
 */

import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { connectToDatabase } from '../../lib/database/mongoose.ts';
import { getMongooseModel } from '../../models/index.ts';
import type {
  AccountStatus,
  CollectionName,
  LearningStyle,
  SupportedLanguage,
  UserRole,
} from '../../types/domain.ts';

export interface NotificationPreferences {
  studyReminders: boolean;
  dueFlashcards: boolean;
  upcomingExams: boolean;
  learningMilestones: boolean;
}

export interface OnboardingMetadata {
  educationSystemCode?: string;
  educationLevelCode?: string;
  targetExaminationCode?: string;
  selectedSubjects?: string[];
}

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: AccountStatus;
  emailVerifiedAt?: Date | null;
  profileImageUrl?: string;
  preferredLanguage: SupportedLanguage;
  country: string;
  educationSystemId?: string;
  educationLevelId?: string;
  targetExaminationId?: string;
  selectedSubjectIds?: string[];
  institution?: string;
  learningPreferences: LearningStyle[];
  timezone: string;
  dailyStudyMinutes: number;
  onboardingCompleted: boolean;
  savedTopicIds: string[];
  notificationPreferences: NotificationPreferences;
  onboardingMeta?: OnboardingMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUserProfile = Omit<UserRecord, 'passwordHash'>;

export function toPublicUserProfile(record: UserRecord): PublicUserProfile {
  const { passwordHash: _omitted, ...publicFields } = record;
  void _omitted;
  return publicFields;
}

export interface CreateUserRepoInput {
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  preferredLanguage: SupportedLanguage;
  timezone: string;
}

export interface ListUsersRepoFilter {
  role?: UserRole;
  status?: AccountStatus;
  search?: string;
  page: number;
  limit: number;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: CreateUserRepoInput): Promise<UserRecord>;
  updateById(id: string, patch: Partial<Omit<UserRecord, 'id' | 'createdAt'>>): Promise<UserRecord | null>;
  listUsers(filter: ListUsersRepoFilter): Promise<{ items: UserRecord[]; total: number }>;
  deleteAccountAndPersonalData(userId: string): Promise<{ deletedUser: boolean; purgedCollections: number }>;
}

const USER_OWNED_COLLECTIONS_TO_PURGE: readonly CollectionName[] = [
  'conversations',
  'messages',
  'generatedContents',
  'quizzes',
  'questions',
  'quizAttempts',
  'flashcardDecks',
  'flashcards',
  'reviewLogs',
  'studyPlans',
  'studyTasks',
  'uploadedMaterials',
  'documentChunks',
  'progressRecords',
  'notifications',
  'feedbackReports',
  'educationLabelConfigs',
];

const CUSTOM_CURRICULUM_COLLECTIONS_TO_PURGE: readonly CollectionName[] = [
  'educationSystems',
  'educationLevels',
  'examinations',
  'subjects',
  'chapters',
  'topics',
];

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  studyReminders: true,
  dueFlashcards: true,
  upcomingExams: true,
  learningMilestones: true,
};

function mapMongoDocToUserRecord(doc: Record<string, unknown>): UserRecord {
  const rawNotif = (doc.notificationPreferences ?? {}) as Partial<NotificationPreferences> & {
    onboardingMeta?: OnboardingMetadata;
    savedTopicIds?: string[];
  };
  return {
    id: String(doc._id),
    fullName: String(doc.fullName ?? ''),
    email: String(doc.email ?? ''),
    passwordHash: String(doc.passwordHash ?? ''),
    role: (doc.role as UserRole) ?? 'student',
    status: (doc.status as AccountStatus) ?? 'active',
    emailVerifiedAt: doc.emailVerifiedAt ? new Date(String(doc.emailVerifiedAt)) : null,
    profileImageUrl: doc.profileImageUrl ? String(doc.profileImageUrl) : undefined,
    preferredLanguage: (doc.preferredLanguage as SupportedLanguage) ?? 'en',
    country: String(doc.country ?? 'BD'),
    educationSystemId: doc.educationSystemId ? String(doc.educationSystemId) : undefined,
    educationLevelId: doc.educationLevelId ? String(doc.educationLevelId) : undefined,
    targetExaminationId: doc.targetExaminationId ? String(doc.targetExaminationId) : undefined,
    selectedSubjectIds: Array.isArray(doc.selectedSubjectIds)
      ? doc.selectedSubjectIds.map((item) => String(item))
      : undefined,
    institution: doc.institution ? String(doc.institution) : undefined,
    learningPreferences: Array.isArray(doc.learningPreferences)
      ? (doc.learningPreferences as LearningStyle[])
      : [],
    timezone: String(doc.timezone ?? 'Asia/Dhaka'),
    dailyStudyMinutes: typeof doc.dailyStudyMinutes === 'number' ? doc.dailyStudyMinutes : 120,
    onboardingCompleted: Boolean(doc.onboardingCompleted),
    savedTopicIds: Array.isArray(doc.savedTopicIds)
      ? doc.savedTopicIds.map((item) => String(item))
      : Array.isArray(rawNotif.savedTopicIds)
        ? rawNotif.savedTopicIds.map((item: unknown) => String(item))
        : [],
    notificationPreferences: {
      studyReminders: rawNotif.studyReminders ?? DEFAULT_NOTIFICATION_PREFS.studyReminders,
      dueFlashcards: rawNotif.dueFlashcards ?? DEFAULT_NOTIFICATION_PREFS.dueFlashcards,
      upcomingExams: rawNotif.upcomingExams ?? DEFAULT_NOTIFICATION_PREFS.upcomingExams,
      learningMilestones:
        rawNotif.learningMilestones ?? DEFAULT_NOTIFICATION_PREFS.learningMilestones,
    },
    onboardingMeta: rawNotif.onboardingMeta,
    createdAt: doc.createdAt ? new Date(String(doc.createdAt)) : new Date(),
    updatedAt: doc.updatedAt ? new Date(String(doc.updatedAt)) : new Date(),
  };
}

export class MongooseUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    await connectToDatabase();
    const UserModel = getMongooseModel('users');
    const doc = await UserModel.findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .lean();
    return doc ? mapMongoDocToUserRecord(doc) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    await connectToDatabase();
    const UserModel = getMongooseModel('users');
    const doc = await UserModel.findById(id).select('+passwordHash').lean();
    return doc ? mapMongoDocToUserRecord(doc) : null;
  }

  async create(input: CreateUserRepoInput): Promise<UserRecord> {
    await connectToDatabase();
    const UserModel = getMongooseModel('users');
    const created = await UserModel.create({
      fullName: input.fullName,
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      role: input.role,
      status: 'active',
      preferredLanguage: input.preferredLanguage,
      country: 'BD',
      timezone: input.timezone,
      dailyStudyMinutes: 120,
      onboardingCompleted: false,
      learningPreferences: ['conceptual_learning'],
      notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
    });
    return mapMongoDocToUserRecord(created as unknown as Record<string, unknown>);
  }

  async updateById(
    id: string,
    patch: Partial<Omit<UserRecord, 'id' | 'createdAt'>>,
  ): Promise<UserRecord | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    await connectToDatabase();
    const UserModel = getMongooseModel('users');
    const updatePayload: Record<string, unknown> = { ...patch };

    if (patch.educationSystemId !== undefined) {
      updatePayload.educationSystemId =
        patch.educationSystemId && mongoose.Types.ObjectId.isValid(patch.educationSystemId)
          ? new mongoose.Types.ObjectId(patch.educationSystemId)
          : null;
    }
    if (patch.educationLevelId !== undefined) {
      updatePayload.educationLevelId =
        patch.educationLevelId && mongoose.Types.ObjectId.isValid(patch.educationLevelId)
          ? new mongoose.Types.ObjectId(patch.educationLevelId)
          : null;
    }
    if (patch.targetExaminationId !== undefined) {
      updatePayload.targetExaminationId =
        patch.targetExaminationId && mongoose.Types.ObjectId.isValid(patch.targetExaminationId)
          ? new mongoose.Types.ObjectId(patch.targetExaminationId)
          : null;
    }
    if (patch.selectedSubjectIds) {
      updatePayload.selectedSubjectIds = patch.selectedSubjectIds
        .filter((sid) => mongoose.Types.ObjectId.isValid(sid))
        .map((sid) => new mongoose.Types.ObjectId(sid));
    }

    if (patch.notificationPreferences || patch.onboardingMeta || patch.savedTopicIds) {
      const existing = await this.findById(id);
      const nextSavedIds = patch.savedTopicIds ?? existing?.savedTopicIds ?? [];
      updatePayload.notificationPreferences = {
        ...(existing?.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFS),
        ...(patch.notificationPreferences ?? {}),
        onboardingMeta: patch.onboardingMeta ?? existing?.onboardingMeta,
        savedTopicIds: nextSavedIds,
      };
      if (patch.savedTopicIds) {
        updatePayload.savedTopicIds = patch.savedTopicIds
          .filter((tid) => mongoose.Types.ObjectId.isValid(tid))
          .map((tid) => new mongoose.Types.ObjectId(tid));
      }
      delete updatePayload.onboardingMeta;
    }

    const updated = await UserModel.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true },
    )
      .select('+passwordHash')
      .lean();
    return updated ? mapMongoDocToUserRecord(updated) : null;
  }

  async listUsers(filter: ListUsersRepoFilter): Promise<{ items: UserRecord[]; total: number }> {
    await connectToDatabase();
    const UserModel = getMongooseModel('users');
    const mongoFilter: Record<string, unknown> = {};
    if (filter.role) mongoFilter.role = filter.role;
    if (filter.status) mongoFilter.status = filter.status;
    if (filter.search?.trim()) {
      const escaped = filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      mongoFilter.$or = [
        { fullName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }
    const skip = Math.max(0, (filter.page - 1) * filter.limit);
    const [docs, total] = await Promise.all([
      UserModel.find(mongoFilter).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
      UserModel.countDocuments(mongoFilter),
    ]);
    return {
      items: docs.map((d) => mapMongoDocToUserRecord(d)),
      total,
    };
  }

  async deleteAccountAndPersonalData(
    userId: string,
  ): Promise<{ deletedUser: boolean; purgedCollections: number }> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { deletedUser: false, purgedCollections: 0 };
    }
    await connectToDatabase();
    const objectId = new mongoose.Types.ObjectId(userId);

    for (const collectionName of USER_OWNED_COLLECTIONS_TO_PURGE) {
      const model = getMongooseModel(collectionName);
      await model.deleteMany({ userId: objectId });
    }
    for (const collectionName of CUSTOM_CURRICULUM_COLLECTIONS_TO_PURGE) {
      const model = getMongooseModel(collectionName);
      await model.deleteMany({ scope: 'custom', ownerUserId: objectId });
    }

    const UserModel = getMongooseModel('users');
    const result = await UserModel.deleteOne({ _id: objectId });
    return {
      deletedUser: result.deletedCount > 0,
      purgedCollections:
        USER_OWNED_COLLECTIONS_TO_PURGE.length + CUSTOM_CURRICULUM_COLLECTIONS_TO_PURGE.length,
    };
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, UserRecord>();

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.store.values()) {
      if (user.email === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const found = this.store.get(id);
    return found ? { ...found } : null;
  }

  async create(input: CreateUserRepoInput): Promise<UserRecord> {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new Error('Duplicate email');
    }
    const now = new Date();
    const record: UserRecord = {
      id: randomBytes(12).toString('hex'),
      fullName: input.fullName,
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      role: input.role,
      status: 'active',
      emailVerifiedAt: null,
      preferredLanguage: input.preferredLanguage,
      country: 'BD',
      learningPreferences: ['conceptual_learning'],
      timezone: input.timezone,
      dailyStudyMinutes: 120,
      onboardingCompleted: false,
      savedTopicIds: [],
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFS },
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(record.id, record);
    return { ...record };
  }

  async updateById(
    id: string,
    patch: Partial<Omit<UserRecord, 'id' | 'createdAt'>>,
  ): Promise<UserRecord | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated: UserRecord = {
      ...existing,
      ...patch,
      savedTopicIds: patch.savedTopicIds ? [...patch.savedTopicIds] : [...existing.savedTopicIds],
      notificationPreferences: {
        ...existing.notificationPreferences,
        ...(patch.notificationPreferences ?? {}),
      },
      onboardingMeta: patch.onboardingMeta ?? existing.onboardingMeta,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  async listUsers(filter: ListUsersRepoFilter): Promise<{ items: UserRecord[]; total: number }> {
    let all = Array.from(this.store.values());
    if (filter.role) {
      all = all.filter((u) => u.role === filter.role);
    }
    if (filter.status) {
      all = all.filter((u) => u.status === filter.status);
    }
    if (filter.search?.trim()) {
      const q = filter.search.trim().toLowerCase();
      all = all.filter(
        (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }
    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = all.length;
    const skip = Math.max(0, (filter.page - 1) * filter.limit);
    const items = all.slice(skip, skip + filter.limit).map((u) => ({ ...u }));
    return { items, total };
  }

  async deleteAccountAndPersonalData(
    userId: string,
  ): Promise<{ deletedUser: boolean; purgedCollections: number }> {
    const existed = this.store.delete(userId);
    return {
      deletedUser: existed,
      purgedCollections: existed ? USER_OWNED_COLLECTIONS_TO_PURGE.length : 0,
    };
  }
}

let fallbackMemoryRepo: InMemoryUserRepository | null = null;
let activeRepoOverride: UserRepository | null = null;

export function setActiveUserRepository(repo: UserRepository | null): void {
  activeRepoOverride = repo;
}

export function getActiveUserRepository(): UserRepository {
  if (activeRepoOverride) {
    return activeRepoOverride;
  }
  if (process.env.MONGODB_URI?.trim()) {
    return new MongooseUserRepository();
  }
  if (!fallbackMemoryRepo) {
    fallbackMemoryRepo = new InMemoryUserRepository();
  }
  return fallbackMemoryRepo;
}
