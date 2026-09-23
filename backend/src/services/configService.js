import { settingsRepository } from '../repositories/settingsRepository.js';
import { printerRepository } from '../repositories/printerRepository.js';
import { paymentMethodRepository } from '../repositories/paymentMethodRepository.js';
import { activityLogService } from './activityLogService.js';
import { dbEngine } from '../database/sqlite.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SerialPort } from 'serialport';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';
import { canonicalTillPrefix, isAssignedTillPrefix } from '../utils/receiptOrderNumber.js';

export const ALLOWED_DEVICE_PREFIXES = ['PC-A', 'PC-B', 'PC-C', 'PC-D', 'PC-E', 'PC-F'];

const isLegacyTillPrefix = (prefix) => {
  const value = String(prefix || '').trim().toUpperCase();
  if (!value) return false;
  if (isAssignedTillPrefix(value)) return false;
  return /^(T[0-9A-F]{2}|PC[1-5]|PC-[1-5])$/i.test(value);
};

const execAsync = promisify(exec);

class ConfigService {
  constructor() {
    this.businessSettings = {};
    this.applicationSettings = {};
    this.initialized = false;
  }

  // Load all settings into memory
  initialize() {
    if (this.initialized) return;
    this.refreshCache();
    
    // Prevent infinite recursion by setting initialized before using getters
    this.initialized = true;

    this._resetClonedIdentityIfNeeded();
    
    // Ensure Device Identity exists
    const syncConfig = this.getSyncConfig();
    if (!syncConfig.device_id) {
      const deviceId = crypto.randomUUID();
      this.updateApplicationCategory('SYSTEM', 'SYNC', { device_id: deviceId });
      console.log(`[ConfigService] Generated persistent device_id: ${deviceId}`);
    }

    try {
      const resetRow = dbEngine.prepare(
        "SELECT value FROM business_settings WHERE key = 'order_number_reset_daily'"
      ).get();
      if (!resetRow) {
        dbEngine.prepare(`
          INSERT INTO business_settings (key, value, category, description)
          VALUES ('order_number_reset_daily', 'true', 'ORDER', 'Restart ticket numbers each business day at 6 AM')
        `).run();
        this.refreshCache();
      }
    } catch { /* settings table may not exist yet */ }
    
    // Only clear junk prefixes (T93, PC1). Never touch A / PC-A / PCA already assigned.
    try {
      const legacy = dbEngine.prepare(
        "SELECT value FROM application_settings WHERE key = 'order_prefix'"
      ).get();
      if (legacy && isLegacyTillPrefix(legacy.value)) {
        dbEngine.prepare("DELETE FROM application_settings WHERE key = 'order_prefix'").run();
        this.refreshCache();
        console.log(`[ConfigService] Removed legacy till prefix ${legacy.value}. Choose A–F on login.`);
      }
    } catch { /* settings table may not exist yet */ }

    try {
      dbEngine.prepare(
        `UPDATE users SET show_on_login = 0, is_active = 0 WHERE username = 'system_user' OR id = '00000000-0000-4000-a000-000000000001'`
      ).run();
    } catch { /* column or table may not exist yet */ }

    try {
      const superRole = dbEngine.prepare(
        `SELECT id FROM roles WHERE name IN ('Super Admin', 'Super Administrator') ORDER BY CASE name WHEN 'Super Admin' THEN 0 ELSE 1 END LIMIT 1`
      ).get();
      if (superRole) {
        dbEngine.prepare(
          `UPDATE users SET role_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE lower(trim(username)) = 'admin'
             AND role_id != ?`
        ).run(superRole.id, superRole.id);
      }
    } catch { /* roles/users may not exist yet */ }

    console.log('[ConfigService] In-memory configuration cache loaded.');
  }

  // First-run marker must NEVER delete live orders. Existing A/PC-A/PCA stays.
  _resetClonedIdentityIfNeeded() {
    const markerPath = path.join(config.paths.root, '.needs-device-claim');
    if (!fs.existsSync(markerPath)) return;
    try {
      let orderCount = 0;
      try {
        orderCount = dbEngine.prepare('SELECT COUNT(*) AS c FROM orders').get()?.c || 0;
      } catch { /* table may not exist */ }
      const prefixRow = dbEngine.prepare(
        "SELECT value FROM application_settings WHERE key = 'order_prefix'"
      ).get();
      const assigned = isAssignedTillPrefix(prefixRow?.value);

      if (orderCount > 0 || assigned) {
        console.log('[ConfigService] Live till detected — keeping orders and device prefix. Wipe skipped.');
      } else {
        dbEngine.prepare("DELETE FROM application_settings WHERE key = 'order_prefix'").run();
        dbEngine.prepare("DELETE FROM application_settings WHERE key = 'device_id'").run();
        this.refreshCache();
        console.log('[ConfigService] Empty till: login will ask for A–F once. Orders were not wiped.');
      }
    } catch (e) {
      console.error('[ConfigService] Failed to process device-claim marker:', e.message);
    }
    try { fs.unlinkSync(markerPath); } catch { /* ignore */ }
  }

  refreshCache() {
    this.businessSettings = settingsRepository.getBusinessSettings();
    this.applicationSettings = settingsRepository.getApplicationSettings();
  }

  // Getters for entire categories
  getBusinessCategory(category) {
    if (!this.initialized) this.initialize();
    return this.businessSettings[category] || {};
  }

  getApplicationCategory(category) {
    if (!this.initialized) this.initialize();
    return this.applicationSettings[category] || {};
  }

  // Specific domain getters
  getBusinessProfile() {
    const profile = this.getBusinessCategory('PROFILE') || {};
    const general = this.getBusinessCategory('GENERAL') || {};
    return {
      ...general,
      ...profile,
      business_name: profile.business_name || general.business_name,
      address: profile.address || profile.business_address || general.business_address || general.address || '',
      phone: profile.phone || profile.phone_number || general.phone_number || general.phone || '',
    };
  }

  getReceiptConfig() {
    return this.getBusinessCategory('RECEIPT');
  }

  getFinanceConfig() {
    return this.getBusinessCategory('FINANCIAL');
  }

  getOrderConfig() {
    return this.getBusinessCategory('ORDER');
  }

  getKitchenConfig() {
    return this.getBusinessCategory('KITCHEN');
  }

  getProductConfig() {
    return this.getBusinessCategory('PRODUCT');
  }

  getVariantCodeStrategy() {
    const config = this.getProductConfig();
    return config.variant_code_strategy || 'SUFFIX'; // 'SUFFIX', 'INDEPENDENT', 'MANUAL'
  }

  getBusinessDay() {
    // Defaults if not set
    const profile = this.getBusinessProfile();
    return {
      start_time: profile.business_day_start || '06:00',
      end_time: profile.business_day_end || '05:59'
    };
  }

  getShortcutConfig() {
    return this.getApplicationCategory('SHORTCUTS');
  }

  getBackupConfig() {
    return this.getApplicationCategory('BACKUP');
  }

  getSyncConfig() {
    const config = this.getApplicationCategory('SYNC') || {};
    return {
      ...config,
      device_role: config.device_role || 'HUB',
      hub_ip: config.hub_ip || '',
      hub_port: Number(config.hub_port) || 5000,
      hub_timeout_ms: Number(config.hub_timeout_ms) || 400,
      lease_block_size: Number(config.lease_block_size) || 500,
      lease_low_water_mark: Number(config.lease_low_water_mark) || 20,
      lease_refill_batch: Number(config.lease_refill_batch) || 200,
      deviceSecret: config.device_secret || '',
    };
  }

  tillConfirmPath() {
    return path.join(config.paths.root, '.till-letter-confirmed-v2');
  }

  needsTillConfirm() {
    try {
      return !fs.existsSync(this.tillConfirmPath());
    } catch {
      return true;
    }
  }

  claimOrderPrefix(prefix) {
    const canonical = canonicalTillPrefix(prefix);
    if (!canonical) {
      throw new Error('Choose A, B, C, D, E or F for this till.');
    }
    this.updateApplicationCategory('SYSTEM', 'SYNC', { order_prefix: canonical });
    try { fs.writeFileSync(this.tillConfirmPath(), canonical); } catch { /* local flag only */ }
    return canonical;
  }

  getLanLoginUrls() {
    const port = process.env.PORT || 5000;
    const urls = [];
    const nets = os.networkInterfaces();
    for (const addrs of Object.values(nets || {})) {
      for (const addr of addrs || []) {
        const family = addr.family === 'IPv4' || addr.family === 4;
        if (family && !addr.internal) {
          urls.push(`http://${addr.address}:${port}/login`);
        }
      }
    }
    return urls;
  }

  // Setters
  updateBusinessCategory(actorId, category, kvPairs) {
    settingsRepository.updateBusinessSettings(category, kvPairs);
    this.refreshCache();
    activityLogService.logActivity(actorId, 'BUSINESS_CONFIG_UPDATED', 'SETTINGS', category, { keys: Object.keys(kvPairs) });
  }

  updateApplicationCategory(actorId, category, kvPairs) {
    settingsRepository.updateApplicationSettings(category, kvPairs);
    this.refreshCache();
    activityLogService.logActivity(actorId, 'APP_CONFIG_UPDATED', 'SETTINGS', category, { keys: Object.keys(kvPairs) });
  }

  // Hardware - Printers
  getAllPrinters() {
    return printerRepository.findAll();
  }

  getPrinterById(id) {
    return printerRepository.findById(id);
  }

  createPrinter(actorId, printerData) {
    const id = printerRepository.create(printerData);
    activityLogService.logActivity(actorId, 'PRINTER_CREATED', 'PRINTER', id, { name: printerData.name });
    return id;
  }

  updatePrinter(actorId, id, printerData) {
    const printer = printerRepository.findById(id);
    if (!printer) throw new Error('Printer not found');
    printerRepository.update(id, printerData);
    activityLogService.logActivity(actorId, 'PRINTER_UPDATED', 'PRINTER', id, { name: printerData.name });
  }

  deletePrinter(actorId, id) {
    const printer = printerRepository.findById(id);
    if (!printer) throw new Error('Printer not found');
    printerRepository.delete(id);
    activityLogService.logActivity(actorId, 'PRINTER_DELETED', 'PRINTER', id, { name: printer.name });
  }

  async discoverPrinters() {
    const discovered = [];

    // 1. Discover COM ports (Bluetooth/Serial)
    try {
      const ports = await SerialPort.list();
      ports.forEach(port => {
        discovered.push({
          name: port.path,
          port: port.path,
          type: 'ESCPOS_BT',
          description: port.friendlyName || 'Bluetooth/Serial Port'
        });
      });
    } catch (err) {
      console.error('[ConfigService] Failed to list COM ports:', err.message);
    }

    // 2. Discover Windows Spooler Printers (USB/Virtual)
    try {
      const { stdout } = await execAsync('powershell -NoProfile -Command "Get-WmiObject -Class Win32_Printer | Select-Object Name, PortName, Network | ConvertTo-Json"', { windowsHide: true });
      if (stdout.trim()) {
        const printers = JSON.parse(stdout);
        const printerList = Array.isArray(printers) ? printers : [printers];
        
        printerList.forEach(p => {
          discovered.push({
            name: p.Name,
            port: p.PortName,
            type: 'ESCPOS_USB',
            description: p.Network ? 'Network Printer' : 'Local Windows Printer'
          });
        });
      }
    } catch (err) {
      console.error('[ConfigService] Failed to list Windows printers:', err.message);
    }

    return discovered;
  }

  // Payment Methods
  getAllPaymentMethods() {
    return paymentMethodRepository.findAll();
  }

  getPaymentMethodByCode(code) {
    return paymentMethodRepository.findByCode(code);
  }

  createPaymentMethod(actorId, methodData) {
    const existing = paymentMethodRepository.findByCode(methodData.code);
    if (existing) throw new Error('Payment method code already exists');
    
    const code = paymentMethodRepository.create(methodData);
    activityLogService.logActivity(actorId, 'PAYMENT_METHOD_CREATED', 'PAYMENT', code, { name: methodData.name });
    return code;
  }

  updatePaymentMethod(actorId, code, methodData) {
    const existing = paymentMethodRepository.findByCode(code);
    if (!existing) throw new Error('Payment method not found');

    paymentMethodRepository.update(code, methodData);
    activityLogService.logActivity(actorId, 'PAYMENT_METHOD_UPDATED', 'PAYMENT', code, { name: methodData.name });
  }

  deletePaymentMethod(actorId, code) {
    const existing = paymentMethodRepository.findByCode(code);
    if (!existing) throw new Error('Payment method not found');
    
    paymentMethodRepository.delete(code);
    activityLogService.logActivity(actorId, 'PAYMENT_METHOD_DELETED', 'PAYMENT', code, { name: existing.name });
  }
}

// Export singleton instance
export const configService = new ConfigService();
