import { cartCacheRepository } from '../repositories/cartCacheRepository.js';
import { cartValidationService } from './cartValidationService.js';
import { cartCalculationService } from './cartCalculationService.js';
import { activityLogService } from './activityLogService.js';
import crypto from 'crypto';

/**
 * CartService — Enterprise Cart Facade
 * 
 * Manages one active working cart per cashier session entirely in memory,
 * with crash-recovery persistence to `cart_cache`. Cart operations NEVER
 * touch order tables, produce order numbers, or emit sync events.
 * 
 * The cart is converted into a permanent Order Draft only when the cashier
 * explicitly initiates checkout (handled by OrderCreationService).
 */
class CartService {
  constructor() {
    // In-memory store: sessionId -> cartObject
    this._carts = new Map();
  }

  // ─────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────

  /**
   * Creates a fresh empty cart object.
   */
  _createEmptyCart(sessionId, cashierUserId, branchId, options = {}) {
    return {
      session_id: sessionId,
      cashier_user_id: cashierUserId,
      branch_id: branchId || 'DEFAULT_BRANCH',
      order_type: options.order_type || 'DINE_IN',
      customer_id: options.customer_id || null,
      table_id: options.table_id || null,
      waiter_id: options.waiter_id || null,
      waiter_name_snapshot: options.waiter_name_snapshot || null,
      rider_id: options.rider_id || null,
      rider_name_snapshot: options.rider_name_snapshot || null,
      notes: options.notes || null,
      kitchen_notes: options.kitchen_notes || null,
      items: [],
      totals: {
        subtotal: 0,
        tax_total: 0,
        discount_total: 0,
        grand_total: 0,
        item_count: 0,
        total_quantity: 0
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Recomputes cart totals from current line items and updates the cart object.
   */
  _refreshTotals(cart) {
    cart.totals = cartCalculationService.calculateCartTotals(cart.items);
    cart.updated_at = new Date().toISOString();
    return cart;
  }

  /**
   * Determines the equality key for a cart line item.
   * Two items sharing identical product, variant, modifiers, add-ons, combo selections,
   * and notes are considered duplicate lines and their quantities will be merged.
   */
  _itemKey(item) {
    const modifiers = [...(item.modifiers || [])]
      .map(m => `${m.modifier_id}:${m.quantity || 1}`)
      .sort()
      .join('|');
    const addons = [...(item.addons || [])]
      .map(a => `${a.addon_id}:${a.quantity || 1}`)
      .sort()
      .join('|');
    const combos = [...(item.comboComponents || [])]
      .map(c => `${c.product_id}:${c.variant_snapshot || ''}`)
      .sort()
      .join('|');
    const notes = (item.notes || '').trim();
    return `${item.product_id}::${item.variant_id || ''}::${modifiers}::${addons}::${combos}::${notes}`;
  }

  /**
   * Persists the cart to crash-recovery cache.
   */
  _persist(cart) {
    try {
      cartCacheRepository.saveCart(
        cart.session_id,
        cart.cashier_user_id,
        cart.branch_id,
        cart
      );
    } catch (e) {
      // Crash-recovery persist failure should never block a cart operation
      console.error('[CartService] Failed to persist cart to crash-recovery cache:', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────

  /**
   * Gets the current active cart for a session.
   * If not in memory, attempts to restore from crash-recovery cache.
   * If nothing found, returns null (caller should create a new cart).
   */
  getCart(sessionId) {
    if (this._carts.has(sessionId)) {
      return this._carts.get(sessionId);
    }

    // Attempt crash-recovery restore
    const recovered = cartCacheRepository.getCart(sessionId);
    if (recovered) {
      this._carts.set(sessionId, recovered);
      return recovered;
    }

    return null;
  }

  /**
   * Gets the current cart or creates an empty one.
   */
  getOrCreateCart(sessionId, cashierUserId, branchId, options = {}) {
    let cart = this.getCart(sessionId);
    if (!cart) {
      cart = this._createEmptyCart(sessionId, cashierUserId, branchId, options);
      this._carts.set(sessionId, cart);
      this._persist(cart);

      activityLogService.logActivity(cashierUserId, 'CART_STARTED', 'CART', sessionId, {
        branch_id: branchId,
        order_type: options.order_type || 'DINE_IN'
      });
    }
    return cart;
  }

  /**
   * Adds an item to the working cart.
   * Validates availability and business rules.
   * Merges quantity if an identical line already exists.
   * Computes pricing via cartCalculationService.
   */
  addItem(sessionId, cashierUserId, branchId, itemInput) {
    // Validate the item first
    cartValidationService.validateCartItem(itemInput);

    const cart = this.getOrCreateCart(sessionId, cashierUserId, branchId);

    // Calculate pricing from backend engine
    const calculated = cartCalculationService.calculateLineItem(itemInput);
    const incomingKey = this._itemKey({
      product_id: calculated.product_id,
      variant_id: calculated.variant_id,
      modifiers: calculated.modifiers.map(m => ({ modifier_id: m.modifier_id, quantity: m.quantity })),
      addons: calculated.addons.map(a => ({ addon_id: a.addon_id, quantity: a.quantity })),
      comboComponents: calculated.comboComponents.map(c => ({ product_id: c.product_id, variant_snapshot: c.variant_snapshot, quantity: c.quantity })),
      notes: calculated.notes
    });

    // Find existing matching line item to merge
    const existingIdx = cart.items.findIndex(existing => this._itemKey(existing) === incomingKey);

    if (existingIdx !== -1) {
      // Merge: add quantity and recalculate line totals
      const existing = cart.items[existingIdx];
      const newQty = existing.quantity + calculated.quantity;

      // Recalculate for merged quantity
      const merged = cartCalculationService.calculateLineItem({ ...itemInput, quantity: newQty });
      cart.items[existingIdx] = {
        ...merged,
        _cart_item_id: existing._cart_item_id // preserve the line item's unique ID
      };

      activityLogService.logActivity(cashierUserId, 'CART_ITEM_MERGED', 'CART', sessionId, {
        product_name_snapshot: calculated.product_name_snapshot,
        old_qty: existing.quantity,
        new_qty: newQty
      });
    } else {
      // New unique line item
      cart.items.unshift({
        ...calculated,
        _cart_item_id: crypto.randomUUID() // Temporary UUID — never persisted to order tables
      });

      activityLogService.logActivity(cashierUserId, 'CART_ITEM_ADDED', 'CART', sessionId, {
        product_name_snapshot: calculated.product_name_snapshot,
        quantity: calculated.quantity
      });
    }

    this._refreshTotals(cart);
    this._persist(cart);
    return cart;
  }

  /**
   * Updates the quantity of a cart line item.
   * If quantity is 0 or less, the item is removed.
   */
  updateItemQuantity(sessionId, cartItemId, newQuantity, cashierUserId) {
    const cart = this.getCart(sessionId);
    if (!cart) throw new Error('No active cart found for this session.');

    const idx = cart.items.findIndex(i => i._cart_item_id === cartItemId);
    if (idx === -1) throw new Error('Cart item not found.');

    if (newQuantity <= 0) {
      return this.removeItem(sessionId, cartItemId, cashierUserId);
    }

    const item = cart.items[idx];
    const oldQty = item.quantity;

    // Recalculate with new quantity
    const updated = cartCalculationService.calculateLineItem({
      product_id: item.product_id,
      variant_id: item.variant_id,
      modifiers: item.modifiers.map(m => ({ modifier_id: m.modifier_id, group_id: m.group_id, price_adjustment: m.price_adjustment, quantity: m.quantity })),
      addons: item.addons.map(a => ({ addon_id: a.addon_id, unit_price: a.unit_price, quantity: a.quantity })),
      comboComponents: item.comboComponents.map(c => ({ component_id: c.component_id, product_id: c.product_id, product_name_snapshot: c.product_name_snapshot, variant_snapshot: c.variant_snapshot, price_adjustment: c.price_adjustment, quantity: c.quantity })),
      quantity: newQuantity,
      notes: item.notes
    });

    cart.items[idx] = { ...updated, _cart_item_id: cartItemId };

    activityLogService.logActivity(cashierUserId || 'SYSTEM', 'CART_ITEM_QTY_CHANGED', 'CART', sessionId, {
      product_name: item.product_name,
      old_qty: oldQty,
      new_qty: newQuantity
    });

    this._refreshTotals(cart);
    this._persist(cart);
    return cart;
  }

  /**
   * Updates cart item details such as notes, modifiers, add-ons, or variant.
   */
  updateItemDetails(sessionId, cartItemId, updates = {}, cashierUserId) {
    const cart = this.getCart(sessionId);
    if (!cart) throw new Error('No active cart found for this session.');

    const idx = cart.items.findIndex(i => i._cart_item_id === cartItemId);
    if (idx === -1) throw new Error('Cart item not found.');

    const current = cart.items[idx];
    const nextItem = {
      ...current,
      notes: updates.notes !== undefined ? updates.notes : current.notes,
      modifiers: updates.modifiers !== undefined ? updates.modifiers : current.modifiers,
      addons: updates.addons !== undefined ? updates.addons : current.addons,
      comboComponents: updates.comboComponents !== undefined ? updates.comboComponents : current.comboComponents,
      variant_id: updates.variant_id !== undefined ? updates.variant_id : current.variant_id
    };

    const recalculated = cartCalculationService.calculateLineItem({
      product_id: nextItem.product_id,
      variant_id: nextItem.variant_id,
      modifiers: nextItem.modifiers || [],
      addons: nextItem.addons || [],
      comboComponents: nextItem.comboComponents || [],
      quantity: nextItem.quantity,
      notes: nextItem.notes
    });

    cart.items[idx] = {
      ...recalculated,
      _cart_item_id: cartItemId
    };

    activityLogService.logActivity(cashierUserId || 'SYSTEM', 'CART_ITEM_UPDATED', 'CART', sessionId, {
      product_name: recalculated.product_name,
      cart_item_id: cartItemId
    });

    this._refreshTotals(cart);
    this._persist(cart);
    return cart;
  }

  /**
   * Duplicates a cart line item as a separate row.
   */
  duplicateItem(sessionId, cartItemId, cashierUserId) {
    const cart = this.getCart(sessionId);
    if (!cart) throw new Error('No active cart found for this session.');

    const idx = cart.items.findIndex(i => i._cart_item_id === cartItemId);
    if (idx === -1) throw new Error('Cart item not found.');

    const duplicate = {
      ...cart.items[idx],
      _cart_item_id: crypto.randomUUID()
    };

    cart.items.unshift(duplicate);

    activityLogService.logActivity(cashierUserId || 'SYSTEM', 'CART_ITEM_DUPLICATED', 'CART', sessionId, {
      product_name: duplicate.product_name,
      source_item_id: cartItemId
    });

    this._refreshTotals(cart);
    this._persist(cart);
    return cart;
  }

  /**
   * Removes a single cart line item.
   */
  removeItem(sessionId, cartItemId, cashierUserId) {
    const cart = this.getCart(sessionId);
    if (!cart) throw new Error('No active cart found for this session.');

    const idx = cart.items.findIndex(i => i._cart_item_id === cartItemId);
    if (idx === -1) throw new Error('Cart item not found.');

    const removed = cart.items[idx];
    cart.items.splice(idx, 1);

    activityLogService.logActivity(cashierUserId || 'SYSTEM', 'CART_ITEM_REMOVED', 'CART', sessionId, {
      product_name: removed.product_name
    });

    this._refreshTotals(cart);
    this._persist(cart);
    return cart;
  }

  /**
   * Sets or updates cart-level notes.
   */
  setNotes(sessionId, { notes, kitchen_notes } = {}) {
    const cart = this.getCart(sessionId);
    if (!cart) throw new Error('No active cart found for this session.');

    if (notes !== undefined) cart.notes = notes;
    if (kitchen_notes !== undefined) cart.kitchen_notes = kitchen_notes;

    cart.updated_at = new Date().toISOString();
    this._persist(cart);
    return cart;
  }

  /**
   * Updates cart metadata (order type, customer, table).
   */
  setCartMeta(sessionId, { order_type, customer_id, table_id, waiter_id, waiter_name_snapshot, rider_id, rider_name_snapshot, is_vip } = {}) {
    const cart = this.getCart(sessionId);
    if (!cart) throw new Error('No active cart found for this session.');

    if (order_type) cart.order_type = order_type;
    if (customer_id !== undefined) cart.customer_id = customer_id || null;
    if (table_id !== undefined) cart.table_id = table_id;
    if (waiter_id !== undefined) cart.waiter_id = waiter_id;
    if (waiter_name_snapshot !== undefined) cart.waiter_name_snapshot = waiter_name_snapshot;
    if (rider_id !== undefined) cart.rider_id = rider_id;
    if (rider_name_snapshot !== undefined) cart.rider_name_snapshot = rider_name_snapshot;
    if (is_vip !== undefined) cart.is_vip = is_vip;

    cart.updated_at = new Date().toISOString();
    this._persist(cart);
    return cart;
  }

  /**
   * Clears all items from the working cart but keeps the session alive.
   */
  clearCart(sessionId, cashierUserId) {
    const cart = this.getCart(sessionId);
    if (!cart) throw new Error('No active cart found for this session.');

    const prevCount = cart.items.length;
    cart.items = [];
    cart.notes = null;
    cart.kitchen_notes = null;

    activityLogService.logActivity(cashierUserId || 'SYSTEM', 'CART_CLEARED', 'CART', sessionId, {
      items_cleared: prevCount
    });

    this._refreshTotals(cart);
    this._persist(cart);
    return cart;
  }

  /**
   * Completely destroys the cart session (called after successful Order creation).
   */
  destroyCart(sessionId) {
    this._carts.delete(sessionId);
    try {
      cartCacheRepository.deleteCart(sessionId);
    } catch (e) {
      console.error('[CartService] Failed to delete cart cache:', e.message);
    }
  }

  /**
   * Attempts to restore a cart from crash-recovery cache.
   * Used on server startup or session reconnection.
   */
  restoreCart(sessionId) {
    const recovered = cartCacheRepository.getCart(sessionId);
    if (recovered) {
      this._carts.set(sessionId, recovered);
      return recovered;
    }
    return null;
  }
}

export const cartService = new CartService();
