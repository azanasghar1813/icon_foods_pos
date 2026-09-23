import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Resolves application paths based on the storage root.
 * Generates absolute paths to ensure reliability across environments (e.g. Electron vs Node).
 * 
 * @param {string} storageRoot - Relative or absolute path to the storage root directory
 * @returns {Object} Centralized absolute paths for the application
 */
export const generatePaths = (storageRoot) => {
  // Resolve storage path relative to the current file (src/config/paths.js)
  // If storageRoot is already absolute, resolve() handles it correctly.
  const absoluteStoragePath = resolve(__dirname, storageRoot);
  
  return {
    root: absoluteStoragePath,
    database: {
      dir: join(absoluteStoragePath, 'database'),
      file: join(absoluteStoragePath, 'database', 'pos.db')
    },
    images: {
      products: join(absoluteStoragePath, 'images', 'products'),
      categories: join(absoluteStoragePath, 'images', 'categories'),
      users: join(absoluteStoragePath, 'images', 'users'),
      business: join(absoluteStoragePath, 'images', 'business'),
    },
    templates: {
      receipts: join(absoluteStoragePath, 'templates', 'receipts'),
    },
    backups: join(absoluteStoragePath, 'backups'),
    exports: join(absoluteStoragePath, 'exports'),
    logs: {
      dir: join(absoluteStoragePath, 'logs'),
      activity: join(absoluteStoragePath, 'logs', 'activity'),
    },
    temp: join(absoluteStoragePath, 'temp'),
    sync: join(absoluteStoragePath, 'sync'),
    updates: join(absoluteStoragePath, 'updates'),
  };
};
