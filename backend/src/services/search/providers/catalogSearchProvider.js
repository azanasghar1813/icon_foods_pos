import { menuCacheService } from '../../menuCacheService.js';
import { searchIndexService } from '../searchIndexService.js';

class CatalogSearchProvider {
  /**
   * Called by the globalSearchService to index all catalog items.
   */
  indexAll() {
    console.log('[CatalogSearchProvider] Indexing catalog...');
    
    // We assume menuCacheService is already initialized with active products.
    // Index Products
    menuCacheService.products.forEach(p => this.indexProduct(p));

    // Index Categories
    menuCacheService.categories.forEach(c => this.indexCategory(c));

    // Index Deals
    menuCacheService.deals.forEach(d => this.indexDeal(d));
  }

  indexProduct(product) {
    if (product.lifecycle_state === 'HIDDEN') return; // Do not index hidden products

    // Create a unified document
    const doc = {
      id: product.id,
      type: 'PRODUCT',
      title: product.name,
      code: product.product_code || '',
      keywords: product.keywords ? product.keywords.split(',').map(k => k.trim()) : [],
      payload: product
    };

    // If it has a display name or short name, we can add it to keywords for matching
    if (product.display_name && product.display_name !== product.name) {
      doc.keywords.push(product.display_name);
    }
    if (product.short_name && product.short_name !== product.name) {
      doc.keywords.push(product.short_name);
    }
    if (product.barcode) {
      doc.keywords.push(product.barcode); // Allow searching by barcode as a keyword
    }

    searchIndexService.indexDocument(doc);

    // Index its variants as separate searchable items if needed, or rely on product match
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach(variant => {
        if (variant.lifecycle_state !== 'HIDDEN') {
          searchIndexService.indexDocument({
            id: variant.id,
            type: 'VARIANT',
            title: `${product.name} - ${variant.name}`,
            code: variant.sku || '',
            keywords: doc.keywords, // inherit product keywords
            payload: { ...variant, product_id: product.id, base_product_name: product.name }
          });
        }
      });
    }
  }

  indexCategory(category) {
    if (category.lifecycle_state === 'HIDDEN') return;
    
    searchIndexService.indexDocument({
      id: category.id,
      type: 'CATEGORY',
      title: category.name,
      code: '',
      keywords: [],
      payload: category
    });
  }

  indexDeal(deal) {
    if (deal.lifecycle_state === 'HIDDEN') return;
    
    searchIndexService.indexDocument({
      id: deal.id,
      type: 'DEAL',
      title: deal.name,
      code: deal.code || '',
      keywords: ['deal', 'combo', 'meal'],
      payload: deal
    });
  }
}

export const catalogSearchProvider = new CatalogSearchProvider();
