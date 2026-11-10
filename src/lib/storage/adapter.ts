/**
 * LearnMate AI — Pluggable Object Storage Abstraction & File Validation
 * Grounded in docs/PROJECT_SRS.md Sections 4.9, 10.2, and 11.
 */

import { AppError } from '../api/errors.ts';
import type { DocumentFormat } from '../../types/domain.ts';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB per file

export const ALLOWED_UPLOAD_MIME_TYPES: Record<string, DocumentFormat> = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export interface UploadFileDescriptor {
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  ownerUserId: string;
}

export interface StoredObjectMetadata {
  storageKey: string;
  provider: 'vercel_blob' | 'local_disk';
  byteSize: number;
  mimeType: string;
  format: DocumentFormat;
}

export interface StorageAdapter {
  putObject(
    descriptor: UploadFileDescriptor,
    bytes: Uint8Array,
  ): Promise<StoredObjectMetadata>;
  getObjectBytes(storageKey: string): Promise<Uint8Array>;
  deleteObject(storageKey: string): Promise<void>;
}

export function validateUploadDescriptor(descriptor: UploadFileDescriptor): DocumentFormat {
  if (!descriptor.ownerUserId) {
    throw AppError.unauthorized('Upload requires an authenticated owner');
  }
  if (descriptor.byteSize <= 0 || descriptor.byteSize > MAX_UPLOAD_BYTES) {
    throw AppError.validation(
      `File size must be between 1 byte and ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`,
    );
  }
  const format = ALLOWED_UPLOAD_MIME_TYPES[descriptor.mimeType];
  if (!format) {
    throw AppError.validation('Unsupported file format. Allowed formats: PDF, TXT, DOCX');
  }
  const lowerName = descriptor.originalFilename.toLowerCase();
  if (!lowerName.endsWith(`.${format}`)) {
    throw AppError.validation(`File extension does not match MIME type (${format})`);
  }
  return format;
}
