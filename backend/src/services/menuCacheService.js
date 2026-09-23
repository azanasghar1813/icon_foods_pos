import { categoryRepository } from '../repositories/categoryRepository.js';
import { productRepository } from '../repositories/productRepository.js';
import { dealRepository } from '../repositories/dealRepository.js';
import { modifierRepository } from '../repositories/modifierRepository.js';
import { variantRepository } from '../repositories/variantRepository.js';
import { routingService } from './routingService.js';
import { globalSearchService } from './search/globalSearchService.js';
import { catalogSearchProvider } from './search/providers/catalogSearchProvider.js';
import { preferLocalProductImage, invalidateLocalProductImageIndex } from '../utils/localProductImage.js';
import { socketService } from './socketService.js';

class MenuCacheService {
  constructor() {
    this.categories = [];
    this.products = [];
    this.deals = [];
    
    // Fast lookup maps
    this.categoryMap = new Map();
    this.productMap = new Map();
    this.variantMap = new Map();
    this.dealMap = new Map();

    // Hierarchical Cache
    this.menuTree = [];
  }

  /**
   * Initializes the in-memory menu cache.
   * Called during application startup or after major catalog changes.
   */
  initialize() {
    console.log('[MenuCache] Initializing menu engine cache...');
    const startTime = Date.now();
    invalidateLocalProductImageIndex();

    // 1. Load raw data from repositories
    // We cache ACTIVE, UNAVAILABLE, and HIDDEN items. DRAFT, ARCHIVED, and DELETED are excluded from POS cache.
    const allowedStates = ['ACTIVE', 'UNAVAILABLE', 'HIDDEN'];
    const rawCategories = categoryRepository.findAll().filter(c => allowedStates.includes(c.lifecycle_state));
    const rawProducts = productRepository.findAll().filter(p => allowedStates.includes(p.lifecycle_state));
    const rawDeals = dealRepository.findAll().filter(d => allowedStates.includes(d.lifecycle_state));

    // 2. Process Categories
    this.categories = rawCategories;
    this.categoryMap.clear();
    rawCategories.forEach(cat => {
      // Add child arrays for the tree
      cat.sub_categories = [];
      cat.products = [];
      this.categoryMap.set(cat.id, cat);
    });

    // 3. Process Products & build fast lookups
    this.products = rawProducts;
    this.productMap.clear();
    this.variantMap.clear();

    rawProducts.forEach(prod => {
      // Fetch modifiers, variants, addons & images eagerly for the cache
      prod.modifier_groups = modifierRepository.getGroupsForProduct(prod.id).filter(g => allowedStates.includes(g.lifecycle_state));
      prod.variants = variantRepository.findByProduct(prod.id).filter(v => allowedStates.includes(v.lifecycle_state)).filter((v, _i, arr) => {
        const key = String(v.name || '').trim().toLowerCase();
        if (!key) return false;
        return arr.findIndex(x => String(x.name || '').trim().toLowerCase() === key) === arr.indexOf(v);
      });
      prod.addons = productRepository.getAddons(prod.id);
      prod.images = productRepository.getImages(prod.id).map((img) => ({
        ...img,
        image_path: preferLocalProductImage(prod.id, img.image_path)
      }));
      
      // Map variants for quick search
      prod.variants.forEach(variant => {
        // Pre-resolve kitchen printer for variants
        variant.resolved_kitchen_printer_id = routingService.resolveKitchenPrinter(prod, variant);
        this.variantMap.set(variant.id, variant);
      });
      
      // Resolve kitchen routing immediately for the product
      prod.resolved_kitchen_printer_id = routingService.resolveKitchenPrinter(prod);
      
      this.productMap.set(prod.id, prod);

      // Attach to category
      const parentCat = this.categoryMap.get(prod.category_id);
      if (parentCat) {
        parentCat.products.push(prod);
      }
    });

    // 4. Build Category Tree
    this.menuTree = [];
    this.categories.forEach(cat => {
      if (cat.parent_id) {
        const parentCat = this.categoryMap.get(cat.parent_id);
        if (parentCat) {
          parentCat.sub_categories.push(cat);
        }
      } else {
        // Root category
        this.menuTree.push(cat);
      }
    });

    // 5. Process Deals
    this.deals = rawDeals;
    this.dealMap.clear();
    rawDeals.forEach(deal => {
      deal.components = dealRepository.getComponents(deal.id);
      this.dealMap.set(deal.id, deal);
    });

    console.log(`[MenuCache] Cached ${this.categories.length} categories, ${this.products.length} products, ${this.variantMap.size} variants, ${this.deals.length} deals in ${Date.now() - startTime}ms`);

    // 6. Register and trigger search engine rebuild if not registered
    try {
      globalSearchService.registerProvider('catalog', catalogSearchProvider);
    } catch (err) {
      // already registered
    }
    // Re-index search engine since cache changed
    globalSearchService.initialize();
    
    // 7. Notify Terminals that the catalog has changed (if running as Hub)
    socketService.emitCatalogUpdated();
  }

  /**
   * Refreshes the cache.
   */
  refresh() {
    this.initialize();
  }

  /**
   * Refreshes a single product in the cache to avoid rebuilding the entire tree.
   * This provides massive performance benefits for enterprise menus.
   */
  refreshProduct(productId) {
    const prod = productRepository.findById(productId);
    
    // If it was deleted, archived, or drafted, remove it from cache
    if (!prod || !['ACTIVE', 'UNAVAILABLE', 'HIDDEN'].includes(prod.lifecycle_state)) {
      this.productMap.delete(productId);
      this.products = this.products.filter(p => p.id !== productId);
      // We should also remove it from the category tree, but a full refresh is safer for deletions
      // For now, removing from products array is enough to hide it from search.
      this.initialize();
      return;
    }

    // Refresh relationships
    prod.modifier_groups = modifierRepository.getGroupsForProduct(prod.id).filter(g => ['ACTIVE', 'UNAVAILABLE', 'HIDDEN'].includes(g.lifecycle_state));
    prod.variants = variantRepository.findByProduct(prod.id).filter(v => ['ACTIVE', 'UNAVAILABLE', 'HIDDEN'].includes(v.lifecycle_state)).filter((v, _i, arr) => {
      const key = String(v.name || '').trim().toLowerCase();
      if (!key) return false;
      return arr.findIndex(x => String(x.name || '').trim().toLowerCase() === key) === arr.indexOf(v);
    });
    prod.addons = productRepository.getAddons(prod.id);
    prod.images = productRepository.getImages(prod.id).map((img) => ({
      ...img,
      image_path: preferLocalProductImage(prod.id, img.image_path)
    }));

    prod.variants.forEach(variant => {
      variant.resolved_kitchen_printer_id = routingService.resolveKitchenPrinter(prod, variant);
      this.variantMap.set(variant.id, variant);
    });

    prod.resolved_kitchen_printer_id = routingService.resolveKitchenPrinter(prod);

    this.productMap.set(productId, prod);
    
    // Update the products array reference
    const index = this.products.findIndex(p => p.id === productId);
    if (index !== -1) {
      this.products[index] = prod;
    } else {
      this.products.push(prod);
    }
    
    // Incrementally re-index this product
    catalogSearchProvider.indexProduct(prod);
  }

  /**
   * Returns the entire hierarchical menu tree.
   */
  getMenuTree() {
    return this.menuTree;
  }
}

export const menuCacheService = new MenuCacheService();
