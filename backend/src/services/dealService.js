import { dealRepository } from '../repositories/dealRepository.js';
import { menuCacheService } from './menuCacheService.js';
import { activityLogService } from './activityLogService.js';
import { lifecycleService } from './lifecycleService.js';
import { syncService } from './syncService.js';
import { settingsRepository } from '../repositories/settingsRepository.js';

function queueDealComponents(dealId) {
  if (!dealId) return;
  const comps = dealRepository.getComponents(dealId) || [];
  settingsRepository.updateApplicationSettings('SYNC', {
    [`deal_components_${dealId}`]: JSON.stringify(comps)
  });
}

class DealService {
  getAllDeals() {
    return menuCacheService.deals;
  }

  getDealById(id) {
    return menuCacheService.dealMap.get(id) || dealRepository.findById(id);
  }

  createDeal(data, userId) {
    const deal = dealRepository.create(data);

    activityLogService.logActivity(
      userId,
      'DEAL_CREATED',
      'CATALOG',
      deal.id,
      {}
    );

    syncService.queueSyncEvent('DEAL', deal.id, 'CREATED', { code: deal.code }, 1);
    try { queueDealComponents(deal.id); } catch { /* sync is best-effort */ }

    menuCacheService.refresh();
    return this.getDealById(deal.id);
  }

  updateDeal(id, data, userId) {
    const deal = dealRepository.update(id, data);

    activityLogService.logActivity(
      userId,
      'DEAL_UPDATED',
      'CATALOG',
      deal.id,
      {}
    );

    syncService.queueSyncEvent('DEAL', deal.id, 'UPDATED', {}, deal.version);
    try { queueDealComponents(deal.id); } catch { /* sync is best-effort */ }

    menuCacheService.refresh();
    return this.getDealById(deal.id);
  }

  deleteDeal(id, userId) {
    lifecycleService.softDelete('DEAL', id, userId);
  }

  archiveDeal(id, userId) {
    lifecycleService.archive('DEAL', id, userId);
  }

  publishDeal(id, userId) {
    lifecycleService.publish('DEAL', id, userId);
  }
}

export const dealService = new DealService();
