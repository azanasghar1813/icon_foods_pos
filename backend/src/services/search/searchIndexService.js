import { rankingService } from './rankingService.js';

class SearchIndexService {
  constructor() {
    this.documents = new Map(); // entity_type:entity_id -> doc
    this.documentList = []; // Fast array for iteration
  }

  /**
   * Adds or updates a document in the index.
   * Document structure:
   * {
   *   id: string,
   *   type: string (e.g. 'PRODUCT', 'CATEGORY'),
   *   title: string,
   *   code: string,
   *   keywords: string[],
   *   popularityScore: number,
   *   recentUsageScore: number,
   *   payload: object (Original entity)
   * }
   */
  indexDocument(doc) {
    if (!doc || !doc.id || !doc.type) {
      throw new Error("Invalid search document. Must have id and type.");
    }
    
    const key = `${doc.type}:${doc.id}`;
    
    // Ensure all string fields are present to avoid null checks during iteration
    doc.title = doc.title || '';
    doc.code = doc.code || '';
    doc.keywords = doc.keywords || [];
    doc.popularityScore = doc.popularityScore || 0;
    doc.recentUsageScore = doc.recentUsageScore || 0;

    this.documents.set(key, doc);
    this._rebuildList();
  }

  removeDocument(type, id) {
    const key = `${type}:${id}`;
    if (this.documents.has(key)) {
      this.documents.delete(key);
      this._rebuildList();
    }
  }

  updatePopularity(type, id, score) {
    const key = `${type}:${id}`;
    const doc = this.documents.get(key);
    if (doc) {
      doc.popularityScore = score;
    }
  }

  updateRecentUsage(type, id, score) {
    const key = `${type}:${id}`;
    const doc = this.documents.get(key);
    if (doc) {
      doc.recentUsageScore = score;
    }
  }

  clear() {
    this.documents.clear();
    this.documentList = [];
  }

  _rebuildList() {
    // Array is much faster for V8 to iterate over sequentially than Map.values()
    this.documentList = Array.from(this.documents.values());
  }

  /**
   * Executes a search query across the index.
   */
  search(query, limit = 50) {
    if (!query) return [];
    
    const q = query.toLowerCase().trim();
    const isNumeric = /^\d+$/.test(q); // Check if purely numbers
    
    const results = [];
    
    // In-memory linear scan is virtually instantaneous for < 100k records in Node.js
    for (let i = 0; i < this.documentList.length; i++) {
      const doc = this.documentList[i];
      const score = rankingService.score(doc, q, isNumeric);
      
      if (score > 0) {
        results.push({
          score,
          document: doc
        });
      }
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    // Return the payload wrapped nicely
    return results.slice(0, limit).map(r => ({
      score: r.score,
      type: r.document.type,
      item: r.document.payload
    }));
  }
}

export const searchIndexService = new SearchIndexService();
