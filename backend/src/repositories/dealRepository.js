import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

class DealRepository {
  findAll() {
    return dbEngine.prepare(`
      SELECT * FROM deals ORDER BY CAST(REPLACE(code, 'D', '') AS INTEGER) ASC
    `).all();
  }

  findById(id) {
    const deal = dbEngine.prepare(`SELECT * FROM deals WHERE id = ?`).get(id);
    if (deal) {
      deal.components = this.getComponents(id);
    }
    return deal;
  }

  create(data) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    dbEngine.prepare(`
      INSERT INTO deals (
        id, code, name, description, price, pricing_strategy, 
        lifecycle_state, start_date, end_date, created_at, updated_at
      ) VALUES (
        @id, @code, @name, @description, @price, @pricing_strategy,
        @lifecycle_state, @start_date, @end_date, @now, @now
      )
    `).run({
      id,
      code: data.code,
      name: data.name,
      description: data.description || null,
      price: data.price || 0,
      pricing_strategy: data.pricing_strategy || 'FIXED',
      lifecycle_state: data.lifecycle_state || 'ACTIVE',
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      now
    });

    if (data.components && Array.isArray(data.components)) {
      this._insertComponents(id, data.components);
    }

    return this.findById(id);
  }

  update(id, data) {
    const updates = [];
    const params = { id, now: new Date().toISOString() };
    const allowed = ['code', 'name', 'description', 'price', 'pricing_strategy', 'start_date', 'end_date', 'lifecycle_state'];

    allowed.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        params[field] = data[field];
      }
    });
    
    if (updates.length > 0) {
      updates.push('version = version + 1');
      updates.push('updated_at = @now');
      dbEngine.prepare(`UPDATE deals SET ${updates.join(', ')} WHERE id = @id`).run(params);
    }

    if (data.components && Array.isArray(data.components)) {
      dbEngine.prepare(`DELETE FROM deal_components WHERE deal_id = ?`).run(id);
      this._insertComponents(id, data.components);
    }

    return this.findById(id);
  }
  delete(id) {
    dbEngine.prepare(`UPDATE deals SET lifecycle_state = 'DELETED', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  }

  getComponents(dealId) {
    return dbEngine.prepare(`
      SELECT * FROM deal_components WHERE deal_id = ?
    `).all(dealId);
  }

  _insertComponents(dealId, components) {
    const insertComponent = dbEngine.prepare(`
      INSERT INTO deal_components (
        id, deal_id, name, component_type, product_id, quantity, target_category_id, target_variant_name, allowed_product_ids, price_adjustment
      ) VALUES (
        @id, @deal_id, @name, @component_type, @product_id, @quantity, @target_category_id, @target_variant_name, @allowed_product_ids, @price_adjustment
      )
    `);

    components.forEach(comp => {
      const type = comp.component_type || 'FIXED_PRODUCT';
      
      if (type === 'FIXED_PRODUCT' && !comp.product_id) {
        throw new Error(`Validation Error: A FIXED_PRODUCT component must have a valid product selected. (Deal ID: ${dealId})`);
      }

      if (type === 'CATEGORY_CHOICE' && !comp.target_category_id && !comp.allowed_product_ids) {
        throw new Error(`Validation Error: A CATEGORY_CHOICE component must have either a target category or allowed products. (Deal ID: ${dealId})`);
      }

      insertComponent.run({
        id: crypto.randomUUID(),
        deal_id: dealId,
        name: comp.name || null,
        component_type: type,
        product_id: comp.product_id || null,
        quantity: comp.quantity || 1,
        target_category_id: comp.target_category_id || null,
        target_variant_name: comp.target_variant_name || null,
        allowed_product_ids: comp.allowed_product_ids || null,
        price_adjustment: comp.price_adjustment || 0
      });
    });
  }
}

export const dealRepository = new DealRepository();
