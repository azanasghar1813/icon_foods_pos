import fs from 'fs/promises';
import config from '../config/index.js';

class StorageManager {
  /**
   * Recursively extracts all directory paths from the paths configuration object.
   * Ignores the `.file` property which represents specific files rather than directories.
   *
   * @param {Object} pathsObj - The paths object to traverse
   * @returns {string[]} An array of absolute directory paths
   */
  _extractDirectories(pathsObj) {
    let directories = [];
    
    for (const key in pathsObj) {
      const val = pathsObj[key];
      if (typeof val === 'string') {
        // Skip file definitions (like pos.db)
        if (!val.endsWith('.db') && !val.endsWith('.json')) {
          directories.push(val);
        }
      } else if (typeof val === 'object' && val !== null) {
        directories = directories.concat(this._extractDirectories(val));
      }
    }
    
    // Deduplicate just in case
    return [...new Set(directories)];
  }

  /**
   * Initializes the storage architecture.
   * Tests for the existence of required directories and creates them if missing.
   * Fails gracefully if permissions are lacking.
   * 
   * @returns {Promise<Object[]>} An array of results for each directory
   */
  async initializeStorage() {
    const directories = this._extractDirectories(config.paths);
    const results = [];

    // Ensure root exists first
    await fs.mkdir(config.paths.root, { recursive: true });

    for (const dir of directories) {
      try {
        // Check if directory exists
        await fs.access(dir, fs.constants.F_OK);
        
        // Test write permissions
        await fs.access(dir, fs.constants.W_OK);
        
        results.push({ path: dir, status: 'VERIFIED' });
      } catch (err) {
        if (err.code === 'ENOENT') {
          try {
            // Directory doesn't exist, create it
            await fs.mkdir(dir, { recursive: true });
            results.push({ path: dir, status: 'CREATED' });
          } catch (createErr) {
            results.push({ path: dir, status: 'FAILED', error: createErr.message });
          }
        } else {
          // Exists but missing permissions or other error
          results.push({ path: dir, status: 'FAILED', error: err.message });
        }
      }
    }
    
    return results;
  }

  /**
   * Safely retrieves a path string from the configuration.
   * Future-proofs modules from importing config directly if path logic gets complex.
   * 
   * @param {string} category - Top level category (e.g. 'images', 'backups')
   * @param {string} [subCategory] - Optional subcategory (e.g. 'products')
   * @returns {string} The absolute path
   */
  getPath(category, subCategory) {
    if (!config.paths[category]) {
      throw new Error(`StorageManager: Category '${category}' does not exist.`);
    }
    if (subCategory) {
      if (!config.paths[category][subCategory]) {
        throw new Error(`StorageManager: Subcategory '${subCategory}' under '${category}' does not exist.`);
      }
      return config.paths[category][subCategory];
    }
    return config.paths[category];
  }
}

export const storageManager = new StorageManager();
