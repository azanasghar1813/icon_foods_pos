class RankingService {
  /**
   * Scores a document against a parsed query string.
   * @param {Object} doc The search document (normalized).
   * @param {string} query The lowercased search query.
   * @param {boolean} isNumeric Whether the query is purely numeric (for code search optimization).
   * @returns {number} Score of the document (higher is better). 0 means no match.
   */
  score(doc, query, isNumeric) {
    if (!query) return 0;
    
    let score = 0;
    const title = (doc.title || '').toLowerCase();
    const code = (doc.code || '').toLowerCase();
    const keywords = (doc.keywords || []).map(k => k.toLowerCase());

    // 1. Exact Code Match (Highest Priority)
    if (code === query) {
      score += 10000;
    }
    // 2. Code Starts With (Critical for the typing use-case: '2', '20', '200')
    else if (code.startsWith(query)) {
      // Shorter codes should rank higher if prefix matches (e.g. 200 matches 200 > 2001)
      const penalty = (code.length - query.length) * 10;
      score += Math.max(5000 - penalty, 1000);
    }
    // 3. Code Contains
    else if (code.includes(query)) {
      score += 500;
    }

    // 4. Exact Title Match
    if (title === query) {
      score += 8000;
    }
    // 5. Title Starts With
    else if (title.startsWith(query)) {
      const penalty = (title.length - query.length) * 5;
      score += Math.max(4000 - penalty, 500);
    }
    // 6. Title Contains (Word boundary starts with is better than just contains)
    else if (title.includes(` ${query}`)) {
      score += 3000;
    }
    else if (title.includes(query)) {
      score += 2000;
    }

    // 7. Keywords Match
    if (keywords.includes(query)) {
      score += 1500;
    } else if (keywords.some(k => k.startsWith(query))) {
      score += 1000;
    } else if (keywords.some(k => k.includes(query))) {
      score += 500;
    }

    // 8. If there is ANY text match, boost by popularity and recent usage
    if (score > 0) {
      // Add popularity score (normalized, max cap to prevent it overwhelming text match)
      // Assuming doc.popularityScore is an absolute number of sales.
      const popBoost = Math.min(doc.popularityScore || 0, 900);
      score += popBoost;

      // Recent usage bump (If used recently in this session, bump it high but below exact matches)
      const recentBoost = Math.min(doc.recentUsageScore || 0, 950);
      score += recentBoost;
    }

    return score;
  }
}

export const rankingService = new RankingService();
