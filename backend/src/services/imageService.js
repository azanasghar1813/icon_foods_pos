import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { storageManager } from '../utils/storageManager.js';
import { productRepository } from '../repositories/productRepository.js';
import { activityLogService } from './activityLogService.js';
import { syncService } from './syncService.js';
import { menuCacheService } from './menuCacheService.js';

class ImageService {
  uploadProductImage(productId, file, isPrimary, userId) {
    if (!file) throw new Error('No file provided');

    // Generate filename
    const ext = path.extname(file.originalname);
    const filename = `${productId}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const destDir = storageManager.getPath('images', 'products');
    const destPath = path.join(destDir, filename);

    // Ensure directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Move file
    fs.copyFileSync(file.path, destPath);
    // Remove temp file
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    const relativePath = `/storage/images/products/${filename}`;
    
    // If primary, the repository handles unsetting previous primaries
    const imageId = productRepository.addImage(productId, relativePath, isPrimary);

    // Bump version and queue sync event
    const product = productRepository.findById(productId);
    if (product) {
      syncService.queueSyncEvent('PRODUCT', productId, 'IMAGE_ADDED', { image_id: imageId }, product.version);
    }

    activityLogService.logActivity(userId, 'PRODUCT_IMAGE_ADDED', 'CATALOG', productId, { image_id: imageId });
    menuCacheService.refresh(); // Or better: refreshProduct(productId)

    return { id: imageId, path: relativePath };
  }

  deleteProductImage(imageId, userId) {
    // 1. Fetch image info
    const imageInfo = productRepository.getImageById(imageId);
    if (!imageInfo) {
      throw new Error('Image not found');
    }

    // 2. Delete from database
    productRepository.removeImage(imageId);
    
    // 3. Delete physical file
    const destDir = storageManager.getPath('images', 'products');
    const absolutePath = path.join(destDir, path.basename(imageInfo.image_path));
    if (fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch (err) {
        console.error('Failed to delete physical image file:', err);
      }
    }
    
    activityLogService.logActivity(userId, 'PRODUCT_IMAGE_DELETED', 'CATALOG', imageId, {});
    menuCacheService.refresh();
  }
}

export const imageService = new ImageService();
