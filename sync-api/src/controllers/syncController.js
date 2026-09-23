import { supabase } from '../config/supabaseClient.js';
import crypto from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rowKey = (tableName, row) => (tableName === 'application_settings' ? row.key : row.id);

const hashPayload = (obj) => {
  if (!obj) return '';
  const clean = { ...obj };
  delete clean.updated_at;
  delete clean.created_at;
  delete clean.payload_version;
  const str = JSON.stringify(clean, Object.keys(clean).sort());
  return crypto.createHash('md5').update(str).digest('hex');
};

export const pushSyncEvents = async (req, res) => {
  try {
    const { events, terminal_id } = req.body;
    const terminalId = req.headers['x-terminal-id'] || terminal_id || 'UNKNOWN';

    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const results = {
      successful: [],
      failed: [],
      conflicts: []
    };

    // Idempotency check: Processed events fallback
    let processedSet = new Set();
    const incomingEventIds = events.map(e => e.id);
    try {
      const { data: alreadyProcessed, error: idempotencyError } = await supabase
        .from('processed_sync_events')
        .select('event_id')
        .in('event_id', incomingEventIds);
        
      if (!idempotencyError && alreadyProcessed) {
        processedSet = new Set(alreadyProcessed.map(r => r.event_id));
      }
    } catch (e) {
      // Ignore if table doesn't exist yet
    }

    const freshEvents = events.filter(e => !processedSet.has(e.id));
    for (const id of processedSet) {
      results.successful.push(id); // Return early success for already-processed events
    }

    // Group events by table and action
    const tableGroups = {};
    for (const event of freshEvents) {
      const { entity_type, entity_id, action, payload, payload_version } = event;
      
      const tableMap = {
        'PRODUCT': 'products',
        'CATEGORY': 'categories',
        'DEAL': 'deals',
        'CUSTOMER': 'customers',
        'USER': 'users',
        'EMPLOYEE': 'users',
        'ORDER': 'orders',
        'ORDER_ITEM': 'order_items',
        'ORDER_PAYMENT': 'order_payments',
        'PAYMENT': 'order_payments',
        'DINING_TABLE': 'dining_tables',
        'SETTING': 'application_settings',
        'VARIANT': 'product_variants',
        'DEAL_COMPONENT': 'deal_components',
        'PRODUCT_IMAGE': 'product_images',
        'MODIFIER': 'modifiers',
        'MODIFIER_GROUP': 'modifier_groups'
      };

      const tableName = tableMap[entity_type.toUpperCase()];

      if (!tableName) {
        if (entity_type.toUpperCase() === 'PRINT' || entity_type.toUpperCase() === 'KDS' || entity_type.toUpperCase() === 'RECEIPT') {
          // Gracefully ignore local-only events
          results.successful.push(event.id);
          continue;
        }
        results.failed.push({ eventId: event.id, error: `Unknown entity_type: ${entity_type}` });
        continue;
      }
      
      if (!tableGroups[tableName]) tableGroups[tableName] = { upserts: [], deletes: [], eventMap: {} };
      if (!tableGroups[tableName].eventMap[entity_id]) tableGroups[tableName].eventMap[entity_id] = [];
      
      if (action === 'DELETE' || action === 'ARCHIVED') {
        tableGroups[tableName].deletes.push(entity_id);
        tableGroups[tableName].eventMap[entity_id].push(event);
      } else {
        try {
          const entityData = typeof payload === 'string' ? JSON.parse(payload) : payload || {};
          
          // --- PAYLOAD SANITIZATION ---
          // Strip local-only columns that do not exist in Supabase cloud schema
          delete entityData.idempotency_key;
          delete entityData.sync_status;
          delete entityData.sync_version;
          delete entityData.synced_at;
          delete entityData.sync_hash;
          delete entityData.failed_login_attempts;
          delete entityData.locked_until;
          delete entityData.force_pin_change;
          
          // Strip kitchen timings which might not be in cloud schema
          delete entityData.kitchen_started_at;
          delete entityData.kitchen_ready_at;
          delete entityData.kitchen_served_at;
          delete entityData.kitchen_completed_at;
          delete entityData.kitchen_cancelled_at;
          
          // Critical Fallbacks for old corrupt data
          if (tableName === 'orders' && !entityData.order_number) {
            entityData.order_number = `FALLBACK-${entity_id.substring(0, 8)}`;
          }
          
          const potentialUuidFields = ['shift_id', 'cashier_user_id', 'table_id', 'waiter_id', 'rider_id', 'customer_id', 'kitchen_station_id', 'kitchen_printer_id', 'parent_id', 'category_id'];
          for (const field of potentialUuidFields) {
            if (entityData[field] && typeof entityData[field] === 'string' && !UUID_RE.test(entityData[field])) {
              entityData[field] = null;
            }
          }

          let upsertObj;
          if (tableName === 'application_settings') {
            delete entityData.id;
            upsertObj = {
              key: entityData.key || entity_id,
              value: entityData.value ?? null,
              description: entityData.description ?? null,
              category: entityData.category || 'GENERAL',
              updated_at: entityData.updated_at || new Date().toISOString(),
              payload_version: payload_version || 1
            };
          } else {
            if (typeof entity_id === 'string' && !UUID_RE.test(entity_id)) {
              results.failed.push({ eventId: event.id, error: `Invalid UUID for ${tableName}.id: ${entity_id}` });
              continue;
            }
            upsertObj = { ...entityData, id: entity_id, payload_version };
          }

          const identity = rowKey(tableName, upsertObj);
          const existingIndex = tableGroups[tableName].upserts.findIndex(u => rowKey(tableName, u) === identity);
          if (existingIndex !== -1) {
            tableGroups[tableName].upserts[existingIndex] = upsertObj;
          } else {
            tableGroups[tableName].upserts.push(upsertObj);
          }
          tableGroups[tableName].eventMap[entity_id].push(event);
        } catch (parseError) {
          console.error('[SyncController] Parse error for event', event.id, parseError);
          results.failed.push({ eventId: event.id, error: 'Invalid payload format: ' + parseError.message });
        }
      }
    }

    // Process tables in dependency order to avoid foreign key violations
    const orderedTables = [
      'users',
      'categories',
      'products',
      'product_variants',
      'deals',
      'customers',
      'dining_tables',
      'orders',
      'order_items',
      'order_payments',
      'application_settings'
    ];

    // Ensure we also process any tables that might have been missed in the ordered list
    const tablesToProcess = [
      ...orderedTables.filter(t => tableGroups[t]),
      ...Object.keys(tableGroups).filter(t => !orderedTables.includes(t))
    ];

    const failedParentOrderIds = new Set();

    for (const tableName of tablesToProcess) {
      const group = tableGroups[tableName];
      
      // Prevent foreign key violations if parent order failed in the same batch
      if (tableName === 'order_items' || tableName === 'order_payments') {
        const initialUpserts = [...group.upserts];
        group.upserts = [];
        for (const u of initialUpserts) {
          if (failedParentOrderIds.has(u.order_id)) {
             const events = group.eventMap[u.id] || [];
             for (const event of events) {
               results.failed.push({ eventId: event.id, error: 'Parent order failed to sync in this batch.' });
             }
             delete group.eventMap[u.id];
          } else {
             group.upserts.push(u);
          }
        }
      }
      
      try {
        if (group.deletes.length > 0) {
          const deleteCol = tableName === 'application_settings' ? 'key' : 'id';
          const { error } = await supabase.from(tableName).delete().in(deleteCol, group.deletes);
          const missingTable = error && /schema cache|does not exist|Could not find the table/i.test(error.message || '');
          if (error && !missingTable) {
             for (const id of group.deletes) {
               const { error: singleError } = await supabase.from(tableName).delete().eq(deleteCol, id);
               if (singleError && !/schema cache|does not exist|Could not find the table/i.test(singleError.message || '')) {
                 const events = group.eventMap[id] || [];
                 for (const event of events) {
                   results.failed.push({ eventId: event.id, error: singleError.message });
                 }
                 delete group.eventMap[id];
               }
             }
          }
        }

        if (group.upserts.length > 0) {
          // Check for conflicts in bulk
          const conflictCol = tableName === 'application_settings' ? 'key' : 'id';
          const ids = group.upserts.map(u => rowKey(tableName, u));
          const { data: existingEntities } = await supabase
            .from(tableName)
            .select('*')
            .in(conflictCol, ids);
            
          const existingMap = {};
          if (existingEntities) {
            existingEntities.forEach(e => { existingMap[rowKey(tableName, e)] = e; });
          }
          
          const validUpserts = [];
          for (const u of group.upserts) {
            const identity = rowKey(tableName, u);
            const eventsForEntity = group.eventMap[identity] || group.eventMap[u.id] || [];
            const primaryEvent = eventsForEntity[0];
            const existing = existingMap[identity];
            let hasConflict = false;
            
            if (existing && primaryEvent) {
              const existingHash = hashPayload(existing);
              const incomingHash = hashPayload(u);
              if (existingHash === incomingHash) {
                continue;
              }

              const isSystemUser = tableName === 'users' && (
                identity === '00000000-0000-4000-a000-000000000001' ||
                String(u.username || existing.username || '').toLowerCase() === 'system_user'
              );
              if (isSystemUser) {
                continue;
              }

              const incomingTs = Date.parse(u.updated_at || '') || 0;
              const existingTs = Date.parse(existing.updated_at || '') || 0;
              const incomingVersion = Number(u.payload_version || 1);
              const existingVersion = Number(existing.payload_version || 1);
              const incomingIsNewer = incomingTs >= existingTs || incomingVersion >= existingVersion;

              // Last write wins so tills can share the same orders/users without stuck conflicts.
              if (!incomingIsNewer && existingVersion > incomingVersion) {
                continue;
              }
            }
            if (!hasConflict) validUpserts.push(u);
          }

          if (validUpserts.length > 0) {
            // Self-referencing FK resolution for categories (parent_id)
            if (tableName === 'categories') {
              // Extract all category IDs in this batch
              const batchCategoryIds = new Set(validUpserts.map(u => u.id));
              
              // Find categories that reference a parent which is also in this batch
              const dependentCategories = validUpserts.filter(u => u.parent_id && batchCategoryIds.has(u.parent_id));
              
              if (dependentCategories.length > 0) {
                // First pass: upsert ALL categories but temporarily strip the parent_id for the dependent ones
                const firstPassUpserts = validUpserts.map(u => {
                  if (u.parent_id && batchCategoryIds.has(u.parent_id)) {
                    return { ...u, parent_id: null };
                  }
                  return u;
                });
                
                // Do first pass
                const { error: firstPassError } = await supabase.from(tableName).upsert(firstPassUpserts, { onConflict: 'id' });
                
                if (firstPassError) {
                  throw new Error(`Categories first pass failed: ${firstPassError.message}`);
                }
              }
            }

            if (tableName === 'dining_tables') {
              for (const u of validUpserts) {
                if (u.table_number && u.id) {
                  try {
                    await supabase.from('dining_tables').delete().eq('table_number', u.table_number).neq('id', u.id);
                  } catch { /* unique cleanup is best-effort */ }
                }
              }
            }

            const { error: upsertError } = await supabase
              .from(tableName)
              .upsert(validUpserts, { onConflict: conflictCol });
              
            if (upsertError) {
              for (const u of validUpserts) {
                const { error: singleError } = await supabase.from(tableName).upsert([u], { onConflict: conflictCol });
                if (singleError) {
                  const identity = rowKey(tableName, u);
                  const events = group.eventMap[identity] || group.eventMap[u.id] || [];
                  for (const event of events) {
                    results.failed.push({ eventId: event.id, error: singleError.message });
                  }
                  delete group.eventMap[u.id];
                  
                  if (tableName === 'orders') {
                    failedParentOrderIds.add(u.id);
                  }
                }
              }
            }
          }
        }
        
        // Mark successful
        for (const entityId of Object.keys(group.eventMap)) {
          const events = group.eventMap[entityId] || [];
          for (const event of events) {
            const isConflict = results.conflicts.some(c => c.eventId === event.id);
            if (!isConflict) {
              results.successful.push(event.id);
            }
          }
        }
      } catch (err) {
        // If bulk fails, mark all events in this group as failed
        for (const entityId of Object.keys(group.eventMap)) {
          const events = group.eventMap[entityId] || [];
          for (const event of events) {
            results.failed.push({ eventId: event.id, error: err.message });
          }
        }
        
        // Ensure child items are blocked from attempting to push
        if (tableName === 'orders') {
          group.upserts.forEach(u => failedParentOrderIds.add(u.id));
        }
      }
    }

    // Record processed event IDs to idempotency table if it exists
    if (results.successful.length > 0) {
      const successfulEventsToRecord = results.successful
        .filter(id => !processedSet.has(id)) // don't insert duplicates
        .map(id => {
          const event = events.find(e => e.id === id);
          return event ? { event_id: id, entity_type: event.entity_type, entity_id: event.entity_id } : null;
        })
        .filter(e => e !== null);
        
      if (successfulEventsToRecord.length > 0) {
        // Fire and forget
        supabase.from('processed_sync_events').insert(successfulEventsToRecord).then(({ error }) => {
          if (error && error.code !== '42P01') { // Ignore 42P01 (relation does not exist)
            console.warn('[SyncController] Failed to record idempotency:', error.message);
          }
        });
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('[SyncController] Push error:', error);
    return res.status(500).json({ error: 'Internal server error during sync push' });
  }
};

const PULL_TABLES = [
  'products',
  'categories',
  'orders',
  'order_items',
  'customers',
  'users',
  'deals',
  'deal_components',
  'order_payments',
  'dining_tables',
  'application_settings',
  'product_variants',
  'product_images',
  'modifiers',
  'modifier_groups'
];

export const pullSyncEvents = async (req, res) => {
  try {
    const { last_sync_timestamp, limit = 50, offset = 0, table } = req.query;
    const sinceMs = parseInt(last_sync_timestamp, 10);
    const since = Number.isFinite(sinceMs) && sinceMs > 0
      ? new Date(sinceMs).toISOString()
      : new Date(0).toISOString();

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    // gte (not gt) so rows that share the watermark timestamp are not skipped.
    const fetchTable = async (tableName) => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .gte('updated_at', since)
        .order('updated_at', { ascending: true })
        .range(parsedOffset, parsedOffset + parsedLimit - 1);

      if (error) throw error;
      return data || [];
    };

    const fetchTableSafe = async (tableName) => {
      try {
        return await fetchTable(tableName);
      } catch (err) {
        console.warn(`[Pull] Skipping ${tableName}:`, err.message);
        return [];
      }
    };

    const requested = String(table || '').trim();
    const tablesToFetch = requested
      ? PULL_TABLES.filter((name) => name === requested)
      : PULL_TABLES;

    const data = {};
    for (const name of PULL_TABLES) data[name] = [];
    await Promise.all(tablesToFetch.map(async (name) => {
      data[name] = await fetchTableSafe(name);
    }));

    return res.status(200).json({
      timestamp: Date.now(),
      data
    });
  } catch (error) {
    console.error('[SyncController] Pull error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during sync pull' });
  }
};

export const allocateOrderNumber = async (req, res) => {
  try {
    const branchId = String(req.body?.branch_id || 'DEFAULT_BRANCH');
    const businessDate = String(req.body?.business_date || '');
    const minSequence = Number(req.body?.min_sequence) || 0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      return res.status(400).json({ error: 'business_date YYYY-MM-DD is required' });
    }

    let seq = null;
    const { data, error } = await supabase.rpc('allocate_order_number', {
      p_branch: branchId,
      p_date: businessDate,
      p_min: minSequence
    });
    if (!error) seq = Number(data);
    if (!Number.isFinite(seq) || seq < 1) {
      const { data: row } = await supabase
        .from('order_counters')
        .select('last_sequence')
        .eq('branch_id', branchId)
        .eq('business_date', businessDate)
        .maybeSingle();
      const last = Number(row?.last_sequence) || 0;
      seq = Math.max(last, minSequence) + 1;
      if (!row) {
        const { error: insErr } = await supabase.from('order_counters').insert({
          branch_id: branchId,
          business_date: businessDate,
          last_sequence: seq
        });
        if (insErr) {
          console.error('[SyncController] allocate insert:', insErr.message);
          return res.status(503).json({ error: insErr.message });
        }
      } else {
        const { error: updErr } = await supabase.from('order_counters').update({
          last_sequence: seq,
          updated_at: new Date().toISOString()
        }).eq('branch_id', branchId).eq('business_date', businessDate).eq('last_sequence', last);
        if (updErr) {
          console.error('[SyncController] allocate update:', updErr.message);
          return res.status(503).json({ error: updErr.message });
        }
      }
    }
    return res.status(200).json({ success: true, data: { sequence: seq, business_date: businessDate } });
  } catch (error) {
    console.error('[SyncController] allocateOrderNumber:', error);
    return res.status(500).json({ error: error.message || 'Failed to allocate order number' });
  }
};

export const peekOrderNumber = async (req, res) => {
  try {
    const branchId = String(req.query?.branch_id || req.body?.branch_id || 'DEFAULT_BRANCH');
    const businessDate = String(req.query?.business_date || req.body?.business_date || '');
    const minSequence = Number(req.query?.min_sequence || req.body?.min_sequence) || 0;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      return res.status(400).json({ error: 'business_date YYYY-MM-DD is required' });
    }
    const { data, error } = await supabase
      .from('order_counters')
      .select('last_sequence')
      .eq('branch_id', branchId)
      .eq('business_date', businessDate)
      .maybeSingle();
    if (error) {
      return res.status(503).json({ error: error.message });
    }
    const last = Number(data?.last_sequence) || 0;
    const next = Math.max(last, minSequence) + 1;
    return res.status(200).json({ success: true, data: { last_sequence: last, next_sequence: next, business_date: businessDate } });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to peek order number' });
  }
};

const HEARTBEAT_TABLES = [
  'products',
  'categories',
  'orders',
  'order_items',
  'customers',
  'users',
  'deals',
  'deal_components',
  'order_payments',
  'dining_tables',
  'application_settings',
  'product_variants',
  'product_images',
  'modifiers',
  'modifier_groups'
];

/**
 * Cheap change check: at most one updated_at row per table, no payloads.
 * Used so tills can skip a full 11-table pull when the cloud has nothing new.
 */
export const heartbeatSync = async (req, res) => {
  try {
    const raw = req.query.last_sync_timestamp || req.query.since || '0';
    const sinceMs = parseInt(String(raw), 10);
    const since = Number.isFinite(sinceMs) && sinceMs > 0
      ? new Date(sinceMs).toISOString()
      : new Date(0).toISOString();

    let watermark = Number.isFinite(sinceMs) && sinceMs > 0 ? sinceMs : 0;
    let changed = false;

    for (const tableName of HEARTBEAT_TABLES) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('updated_at')
          .gt('updated_at', since)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (error) continue;
        const ts = data?.[0]?.updated_at;
        if (!ts) continue;
        changed = true;
        const ms = Date.parse(ts);
        if (Number.isFinite(ms) && ms > watermark) watermark = ms;
      } catch {
        /* table may be missing */
      }
    }

    return res.status(200).json({
      success: true,
      data: { changed, watermark }
    });
  } catch (error) {
    console.error('[SyncController] heartbeat:', error);
    return res.status(500).json({ error: error.message || 'Heartbeat failed' });
  }
};
