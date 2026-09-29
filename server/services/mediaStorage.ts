import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, open, unlink } from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { fileTypeFromFile } from 'file-type';
import { config } from '../config/env';
import { MediaFile } from '../models/types';

const extensionTypes: Record<string, { mimeTypes: string[]; category: MediaFile['fileCategory'] }> = {
  '.jpg': { mimeTypes: ['image/jpeg'], category: 'image' },
  '.jpeg': { mimeTypes: ['image/jpeg'], category: 'image' },
  '.png': { mimeTypes: ['image/png'], category: 'image' },
  '.webp': { mimeTypes: ['image/webp'], category: 'image' },
  '.pdf': { mimeTypes: ['application/pdf'], category: 'document' },
  '.zip': { mimeTypes: ['application/zip', 'application/x-zip-compressed'], category: 'file' },
  '.stl': { mimeTypes: ['model/stl', 'application/sla', 'application/octet-stream'], category: '3d' },
  '.3mf': { mimeTypes: ['model/3mf', 'application/octet-stream', 'application/zip'], category: '3d' },
  '.step': { mimeTypes: ['model/step', 'application/step', 'text/plain'], category: '3d' },
  '.stp': { mimeTypes: ['model/step', 'application/step', 'text/plain'], category: '3d' },
};

export function getUploadCategory(originalName: string, mimeType: string): MediaFile['fileCategory'] | null {
  const extension = path.extname(originalName).toLowerCase();
  const type = extensionTypes[extension];
  return type?.mimeTypes.includes(mimeType.toLowerCase()) ? type.category : null;
}

async function hasExpectedSignature(filePath: string, originalName: string): Promise<boolean> {
  const extension = path.extname(originalName).toLowerCase();
  if (extension === '.step' || extension === '.stp' || extension === '.stl') {
    const handle = await open(filePath, 'r');
    try {
      const { size } = await handle.stat();
      const header = Buffer.alloc(Math.min(size, 256));
      await handle.read(header, 0, header.length, 0);
      if (header.includes(0)) {
        if (extension !== '.stl' || size < 84) return false;
        const binaryHeader = Buffer.alloc(84);
        await handle.read(binaryHeader, 0, 84, 0);
        const triangleCount = binaryHeader.readUInt32LE(80);
        return 84 + triangleCount * 50 === size;
      }
      const textHeader = header.toString('utf8').trimStart();
      if (extension === '.stl') {
        const tail = Buffer.alloc(Math.min(size, 256));
        await handle.read(tail, 0, tail.length, Math.max(size - tail.length, 0));
        return /^solid(?:\s|$)/i.test(textHeader) && /endsolid\s*$/i.test(tail.toString('utf8').trim());
      }
      return textHeader.startsWith('ISO-10303-21;');
    } finally {
      await handle.close();
    }
  }

  const detected = await fileTypeFromFile(filePath);
  if (!detected) return false;
  const allowedByExtension: Record<string, string[]> = {
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.png': ['image/png'],
    '.webp': ['image/webp'],
    '.pdf': ['application/pdf'],
    '.zip': ['application/zip'],
    '.3mf': ['application/zip'],
  };
  return allowedByExtension[extension]?.includes(detected.mime) === true;
}

function isSafeOriginalName(name: string): boolean {
  return Boolean(
    name &&
      name.length <= 255 &&
      !/[\\/\0-\x1f]/.test(name) &&
      name !== '.' &&
      name !== '..' &&
      path.basename(name) === name &&
      path.win32.basename(name) === name
  );
}

export class LocalMediaStorage {
  readonly rootPath = config.mediaStoragePath;

  private resolveKey(storageKey: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storageKey)) {
      throw new Error('Ungültiger Storage-Key.');
    }

    const absolutePath = path.resolve(this.rootPath, storageKey);
    const relativePath = path.relative(this.rootPath, absolutePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('Storage-Key liegt außerhalb des privaten Speicherbereichs.');
    }
    return absolutePath;
  }

  readonly upload = multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => {
        mkdir(this.rootPath, { recursive: true }).then(
          () => callback(null, this.rootPath),
          (error: NodeJS.ErrnoException) => callback(error, this.rootPath)
        );
      },
      filename: (_request, _file, callback) => callback(null, randomUUID()),
    }),
    limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 4 },
    fileFilter: (_request, file, callback) => {
      if (!isSafeOriginalName(file.originalname) || !getUploadCategory(file.originalname, file.mimetype)) {
        callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
        return;
      }
      callback(null, true);
    },
  });

  createReadStream(storageKey: string) {
    return createReadStream(this.resolveKey(storageKey));
  }

  verifyFile(filePath: string, originalName: string): Promise<boolean> {
    return hasExpectedSignature(filePath, originalName);
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(this.resolveKey(storageKey));
  }
}

export const mediaStorage = new LocalMediaStorage();