import { popularityService } from './popularityService.js';
import { recentUsageService } from './recentUsageService.js';
import { searchIndexService } from './searchIndexService.js';

class SuggestionService {
  /**
   * Generates smart suggestions when the search bar is empty.
   * Blends "Recently Used" with "Most Popular Today".
   */
  getSuggestions(userId, limit = 20) {
    const results = [];
    const seenIds = new Set(); // Prevent duplicates

    // Helper to safely fetch from memory index
    const addEntity = (type, id, reason) => {
      if (seenIds.has(`${type}:${id}`)) return;
      if (results.length >= limit) return;

      const doc = searchIndexService.documents.get(`${type}:${id}`);
      if (doc) {
        results.push({
          type: doc.type,
          item: doc.payload,
          suggestion_reason: reason
        });
        seenIds.add(`${type}:${id}`);
      }
    };

    // 1. Fetch Top 5 Recent Usage for this Cashier
    const recent = recentUsageService.getRecent(userId, 5, 'PRODUCT');
    recent.forEach(r => addEntity('PRODUCT', r.entity_id, 'RECENTLY_USED'));

    // 2. Fetch Top Popular TODAY
    const popularToday = popularityService.getTopPopular('TODAY', 10, 'PRODUCT');
    popularToday.forEach(p => addEntity('PRODUCT', p.entity_id, 'POPULAR_TODAY'));

    // 3. Fallback: Top Popular ALL_TIME
    if (results.length < limit) {
      const popularAllTime = popularityService.getTopPopular('ALL_TIME', limit - results.length, 'PRODUCT');
      popularAllTime.forEach(p => addEntity('PRODUCT', p.entity_id, 'POPULAR_ALL_TIME'));
    }

    return results;
  }
}

export const suggestionService = new SuggestionService();
