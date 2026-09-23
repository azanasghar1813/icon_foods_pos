/**
 * HistoryCacheService
 *
 * In-memory LRU cache for order history data.
 * Historical orders (older than today) rarely change — they are ideal cache candidates.
 * Today's orders are cached with a short TTL.
 *
 * Design:
 *  - Max 500 order detail entries in memory
 *  - Today list: TTL 30 seconds (refreshes frequently)
 *  - Historical orders: TTL 10 minutes (rarely change)
 *  - Cache is a Map with LRU eviction (manual implementation)
 */
class HistoryCacheService {
  constructor() {
    // Detail cache: orderId → { data, expiresAt }
    this._detailCache = new Map();
    // List cache: cacheKey → { data, expiresAt }
    this._listCache   = new Map();

    this._maxDetailEntries = 500;
    this._maxListEntries   = 50;

    // TTLs in milliseconds
    this._todayTtl     = 30 * 1000;       // 30 seconds
    this._historicalTtl = 10 * 60 * 1000; // 10 minutes
    this._listTtl       = 15 * 1000;      // 15 seconds for list pages

    this._hits   = 0;
    this._misses = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Order Detail Cache
  // ──────────────────────────────────────────────────────────────────────────

  getDetail(orderId) {
    const entry = this._detailCache.get(orderId);
    if (!entry) { this._misses++; return null; }
    if (Date.now() > entry.expiresAt) {
      this._detailCache.delete(orderId);
      this._misses++;
      return null;
    }
    this._hits++;
    return entry.data;
  }

  setDetail(orderId, data, businessDate = null) {
    // Determine TTL based on whether this is today's order
    const today    = new Date().toISOString().slice(0, 10);
    const isToday  = businessDate === today;
    const ttl      = isToday ? this._todayTtl : this._historicalTtl;

    // Evict oldest if at capacity
    if (this._detailCache.size >= this._maxDetailEntries) {
      this._evictOldest(this._detailCache);
    }

    this._detailCache.set(orderId, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  invalidateDetail(orderId) {
    this._detailCache.delete(orderId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // List Cache
  // ──────────────────────────────────────────────────────────────────────────

  getList(cacheKey) {
    const entry = this._listCache.get(cacheKey);
    if (!entry) { this._misses++; return null; }
    if (Date.now() > entry.expiresAt) {
      this._listCache.delete(cacheKey);
      this._misses++;
      return null;
    }
    this._hits++;
    return entry.data;
  }

  setList(cacheKey, data) {
    if (this._listCache.size >= this._maxListEntries) {
      this._evictOldest(this._listCache);
    }
    this._listCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + this._listTtl,
    });
  }

  invalidateList() {
    this._listCache.clear();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Full Invalidation (called when an order changes state)
  // ──────────────────────────────────────────────────────────────────────────

  invalidateOrder(orderId) {
    this.invalidateDetail(orderId);
    // Clear all list caches — they may contain this order
    this.invalidateList();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Stats & Maintenance
  // ──────────────────────────────────────────────────────────────────────────

  getStats() {
    return {
      detail_entries: this._detailCache.size,
      list_entries:   this._listCache.size,
      hits:           this._hits,
      misses:         this._misses,
      hit_rate:       this._hits + this._misses > 0
        ? ((this._hits / (this._hits + this._misses)) * 100).toFixed(1) + '%'
        : '0%',
    };
  }

  clearAll() {
    this._detailCache.clear();
    this._listCache.clear();
    this._hits   = 0;
    this._misses = 0;
  }

  /**
   * Build a deterministic cache key from filter + pagination params.
   */
  buildListKey(filters, page, limit) {
    const sortedFilters = Object.keys(filters)
      .sort()
      .reduce((acc, k) => { acc[k] = filters[k]; return acc; }, {});
    return `list:${JSON.stringify(sortedFilters)}:${page}:${limit}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────────────────────────────────

  _evictOldest(map) {
    // Map insertion order = LRU via delete+set. Just remove the first entry.
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) {
      map.delete(firstKey);
    }
  }
}

export const historyCacheService = new HistoryCacheService();
