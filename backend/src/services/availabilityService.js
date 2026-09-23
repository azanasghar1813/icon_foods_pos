import { productRepository } from '../repositories/productRepository.js';
import { menuCacheService } from './menuCacheService.js';

class AvailabilityService {
  /**
   * Determines if an entity is currently orderable based on its lifecycle state and schedule.
   * @param {Object} entity 
   */
  isOrderable(entity) {
    if (!entity) return false;

    // 1. Basic Lifecycle State Check
    if (entity.lifecycle_state !== 'ACTIVE' && entity.lifecycle_state !== 'HIDDEN') {
      return false;
    }

    // 2. Future: Check Time-Based Availability
    // e.g. Breakfast items only available 8am - 11am

    // 3. Future: Check Stock/Inventory level

    return true;
  }

  /**
   * Filters a list of entities down to only those that are currently orderable.
   * @param {Array} entities 
   */
  getAvailable(entities) {
    if (!entities) return [];
    return entities.filter(e => this.isOrderable(e));
  }
}

export const availabilityService = new AvailabilityService();
