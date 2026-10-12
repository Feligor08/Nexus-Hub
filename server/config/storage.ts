import path from 'path';
import { mkdir, access, constants } from 'fs/promises';

/**
 * Centralized Media Storage Configuration (Sprint 7)
 * Resolves MEDIA_STORAGE_PATH centrally to prevent fragmented hardcoded paths.
 */
export const MEDIA_STORAGE_PATH = path.resolve(
  process.env.MEDIA_STORAGE_PATH?.trim() || './storage/media'
);

export interface StorageInitResult {
  initialized: boolean;
  path: string;
  error?: string;
}

/**
 * Verifies that MEDIA_STORAGE_PATH is accessible and exists, or creates it recursively.
 * Fails clearly if permissions or paths are invalid.
 */
export async function ensureStorageInitialized(): Promise<StorageInitResult> {
  try {
    await mkdir(MEDIA_STORAGE_PATH, { recursive: true });
    await access(MEDIA_STORAGE_PATH, constants.R_OK | constants.W_OK);
    return {
      initialized: true,
      path: MEDIA_STORAGE_PATH,
    };
  } catch (err: any) {
    const errorMsg = `Storage initialization failed for "${MEDIA_STORAGE_PATH}": ${err.message}`;
    console.error(`[Storage] CRITICAL: ${errorMsg}`);
    return {
      initialized: false,
      path: MEDIA_STORAGE_PATH,
      error: errorMsg,
    };
  }
}
