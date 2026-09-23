import crypto from 'crypto';
import { dbEngine } from '../database/sqlite.js';

class ModifierRepository {
  // ----------------------------------------------------
  // Modifier Groups
  // ----------------------------------------------------
  createGroup(data) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = dbEngine.db.prepare(`
      INSERT INTO modifier_groups (
        id, name, description, min_selection, max_selection, 
        is_required, display_order, lifecycle_state, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @min_selection, @max_selection,
        @is_required, @display_order, @lifecycle_state, @now, @now
      )
    `);

    stmt.run({
      id,
      name: data.name,
      description: data.description || null,
      min_selection: data.min_selection || 0,
      max_selection: data.max_selection || null,
      is_required: data.is_required ? 1 : 0,
      display_order: data.display_order || 0,
      lifecycle_state: data.lifecycle_state || 'DRAFT',
      now
    });

    return this.findGroupById(id);
  }

  updateGroup(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const params = { id, now };

    const allowed = ['name', 'description', 'min_selection', 'max_selection', 'is_required', 'display_order'];
    allowed.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        params[field] = data[field];
      }
    });

    if (updates.length > 0) {
      updates.push('version = version + 1');
      updates.push('updated_at = @now');
      const stmt = dbEngine.db.prepare(`UPDATE modifier_groups SET ${updates.join(', ')} WHERE id = @id`);
      stmt.run(params);
    }
    return this.findGroupById(id);
  }

  deleteGroup(id) {
    const stmt = dbEngine.db.prepare(`UPDATE modifier_groups SET lifecycle_state = 'DELETED', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    stmt.run(id);
  }

  findGroupById(id) {
    const stmt = dbEngine.db.prepare(`SELECT * FROM modifier_groups WHERE id = ?`);
    return stmt.get(id);
  }

  findAllGroups() {
    const stmt = dbEngine.db.prepare(`SELECT * FROM modifier_groups ORDER BY display_order ASC, name ASC`);
    return stmt.all();
  }

  // ----------------------------------------------------
  // Modifiers
  // ----------------------------------------------------
  createModifier(data) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = dbEngine.db.prepare(`
      INSERT INTO modifiers (
        id, name, short_name, price_adjustment, lifecycle_state, created_at, updated_at
      ) VALUES (
        @id, @name, @short_name, @price_adjustment, @lifecycle_state, @now, @now
      )
    `);

    stmt.run({
      id,
      name: data.name,
      short_name: data.short_name || null,
      price_adjustment: data.price_adjustment || 0,
      lifecycle_state: data.lifecycle_state || 'DRAFT',
      now
    });

    return this.findModifierById(id);
  }

  updateModifier(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const params = { id, now };

    const allowed = ['name', 'short_name', 'price_adjustment'];
    allowed.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        params[field] = data[field];
      }
    });

    if (updates.length > 0) {
      updates.push('version = version + 1');
      updates.push('updated_at = @now');
      const stmt = dbEngine.db.prepare(`UPDATE modifiers SET ${updates.join(', ')} WHERE id = @id`);
      stmt.run(params);
    }
    return this.findModifierById(id);
  }

  findModifierById(id) {
    const stmt = dbEngine.db.prepare(`SELECT * FROM modifiers WHERE id = ?`);
    return stmt.get(id);
  }

  findAllModifiers() {
    const stmt = dbEngine.db.prepare(`SELECT * FROM modifiers ORDER BY name ASC`);
    return stmt.all();
  }

  // ----------------------------------------------------
  // Options (Linking Modifier to Group)
  // ----------------------------------------------------
  addOptionToGroup(groupId, modifierId, data = {}) {
    const id = crypto.randomUUID();
    const stmt = dbEngine.db.prepare(`
      INSERT INTO modifier_group_options (
        id, modifier_group_id, modifier_id, price_adjustment, display_order, is_default, max_quantity_per_selection
      ) VALUES (
        @id, @modifier_group_id, @modifier_id, @price_adjustment, @display_order, @is_default, @max_quantity_per_selection
      )
    `);

    stmt.run({
      id,
      modifier_group_id: groupId,
      modifier_id: modifierId,
      price_adjustment: data.price_adjustment !== undefined ? data.price_adjustment : null,
      display_order: data.display_order || 0,
      is_default: data.is_default ? 1 : 0,
      max_quantity_per_selection: data.max_quantity_per_selection || 1
    });

    return id;
  }

  removeOptionFromGroup(optionId) {
    const stmt = dbEngine.db.prepare(`DELETE FROM modifier_group_options WHERE id = ?`);
    stmt.run(optionId);
  }

  getOptionsForGroup(groupId) {
    const stmt = dbEngine.db.prepare(`
      SELECT o.*, m.name, m.short_name, 
             COALESCE(o.price_adjustment, m.price_adjustment) as effective_price
      FROM modifier_group_options o
      JOIN modifiers m ON o.modifier_id = m.id
      WHERE o.modifier_group_id = ?
      ORDER BY o.display_order ASC, m.name ASC
    `);
    return stmt.all(groupId);
  }

  // ----------------------------------------------------
  // Product Links
  // ----------------------------------------------------
  linkGroupToProduct(productId, groupId, displayOrder = 0) {
    const stmt = dbEngine.db.prepare(`
      INSERT INTO product_modifier_groups (product_id, modifier_group_id, display_order)
      VALUES (?, ?, ?)
      ON CONFLICT(product_id, modifier_group_id) DO UPDATE SET display_order = excluded.display_order
    `);
    stmt.run(productId, groupId, displayOrder);
  }

  unlinkGroupFromProduct(productId, groupId) {
    const stmt = dbEngine.db.prepare(`
      DELETE FROM product_modifier_groups WHERE product_id = ? AND modifier_group_id = ?
    `);
    stmt.run(productId, groupId);
  }

  getGroupsForProduct(productId) {
    const stmt = dbEngine.db.prepare(`
      SELECT g.*, pmg.display_order as product_display_order
      FROM modifier_groups g
      JOIN product_modifier_groups pmg ON g.id = pmg.modifier_group_id
      WHERE pmg.product_id = ?
      ORDER BY pmg.display_order ASC, g.display_order ASC
    `);
    
    const groups = stmt.all(productId);
    groups.forEach(g => {
      g.options = this.getOptionsForGroup(g.id);
    });
    return groups;
  }
}

export const modifierRepository = new ModifierRepository();
