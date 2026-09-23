export default {
  version: '036',
  name: 'service_charge_seven',
  up: (db) => {
    db.prepare(`
      UPDATE business_settings
      SET value = '7', description = 'Default Service Charge'
      WHERE key IN ('service_charge_percent', 'service_charge_rate')
    `).run();
  },
  down: () => {}
};
