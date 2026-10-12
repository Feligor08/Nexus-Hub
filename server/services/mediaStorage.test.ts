import { describe, expect, it } from 'vitest';
import { getUploadCategory } from './mediaStorage';
import { ensureStorageInitialized, MEDIA_STORAGE_PATH } from '../config/storage';

describe('Media Storage & Path Security (Sprint 7)', () => {
  it('resolves centralized MEDIA_STORAGE_PATH correctly', () => {
    expect(MEDIA_STORAGE_PATH).toBeDefined();
    expect(typeof MEDIA_STORAGE_PATH).toBe('string');
  });

  it('initializes the storage directory recursively', async () => {
    const result = await ensureStorageInitialized();
    expect(result.initialized).toBe(true);
    expect(result.path).toBe(MEDIA_STORAGE_PATH);
  });

  it('validates allowed upload categories based on MIME and extension', () => {
    expect(getUploadCategory('screenshot.png', 'image/png')).toBe('image');
    expect(getUploadCategory('photo.jpeg', 'image/jpeg')).toBe('image');
    expect(getUploadCategory('graphic.webp', 'image/webp')).toBe('image');
    expect(getUploadCategory('spec.pdf', 'application/pdf')).toBe('document');
    expect(getUploadCategory('archive.zip', 'application/zip')).toBe('file');
    expect(getUploadCategory('model.stl', 'model/stl')).toBe('3d');
  });

  it('rejects forbidden or spoofed MIME/extensions', () => {
    // Executable / scripts
    expect(getUploadCategory('hack.exe', 'application/x-msdownload')).toBeNull();
    expect(getUploadCategory('script.sh', 'application/x-sh')).toBeNull();
    expect(getUploadCategory('exploit.php', 'application/x-php')).toBeNull();
    // Spoofed mime type (exe pretending to be png)
    expect(getUploadCategory('malware.exe', 'image/png')).toBeNull();
    // Generic octet-stream for random files
    expect(getUploadCategory('random.bin', 'application/octet-stream')).toBeNull();
  });
});
