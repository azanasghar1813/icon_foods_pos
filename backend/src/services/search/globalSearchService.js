import { searchIndexService } from './searchIndexService.js';
import { suggestionService } from './suggestionService.js';
import { popularityService } from './popularityService.js';

class GlobalSearchService {
  constructor() {
    this.providers = new Map(); // name -> provider
  }

  /**
   * Registers a search provider (e.g. CatalogSearchProvider, CustomerSearchProvider).
   */
  registerProvider(name, provider) {
    if (this.providers.has(name)) {
      throw new Error(`Search provider ${name} is already registered.`);
    }
    this.providers.set(name, provider);
  }

  /**
   * Initializes the search engine by calling all registered providers to index their data.
   */
  initialize() {
    console.log('[GlobalSearch] Initializing search engine...');
    const start = Date.now();
    
    // Clear the index
    searchIndexService.clear();

    // Rebuild index from all providers
    for (const [name, provider] of this.providers.entries()) {
      provider.indexAll();
    }

    // Load persisted analytics into the index
    popularityService.loadIntoIndex();

    console.log(`[GlobalSearch] Ready. Indexed ${searchIndexService.documentList.length} total items in ${Date.now() - start}ms.`);
  }

  /**
   * Performs a global search.
   * If query is empty, returns smart suggestions.
   */
  search(query, userId, limit = 50) {
    if (!query || query.trim() === '') {
      // Empty state -> Smart Suggestions
      return suggestionService.getSuggestions(userId, limit);
    }

    // Standard search
    const results = searchIndexService.search(query, limit);
    return results;
  }
}

export const globalSearchService = new GlobalSearchService();
