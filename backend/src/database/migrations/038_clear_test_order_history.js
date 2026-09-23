/**
 * Disabled. Updating the EXE must never wipe live AppData order history.
 * Kept as a no-op so version 038 still records and will not run deletes later.
 */
export default {
  version: '038',
  name: 'clear_test_order_history',

  up: () => {
    console.log('[Migration 038] Order-history wipe disabled. Existing tickets are kept.');
  },

  down: () => {}
};
