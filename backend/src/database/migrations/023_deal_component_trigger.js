export default {
  version: '023',
  name: 'deal_component_trigger',

  up: (db) => {
    console.log('023: Adding database trigger for deal components validation');

    // Add BEFORE INSERT trigger
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS prevent_null_product_id_insert
      BEFORE INSERT ON deal_components
      FOR EACH ROW
      WHEN NEW.component_type = 'FIXED_PRODUCT' AND NEW.product_id IS NULL
      BEGIN
        SELECT RAISE(ABORT, 'FIXED_PRODUCT components must have a product_id');
      END;
    `);

    // Add BEFORE UPDATE trigger
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS prevent_null_product_id_update
      BEFORE UPDATE ON deal_components
      FOR EACH ROW
      WHEN NEW.component_type = 'FIXED_PRODUCT' AND NEW.product_id IS NULL
      BEGIN
        SELECT RAISE(ABORT, 'FIXED_PRODUCT components must have a product_id');
      END;
    `);

    // Add BEFORE INSERT trigger for CATEGORY_CHOICE
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS prevent_invalid_category_choice_insert
      BEFORE INSERT ON deal_components
      FOR EACH ROW
      WHEN NEW.component_type = 'CATEGORY_CHOICE' AND NEW.target_category_id IS NULL AND NEW.allowed_product_ids IS NULL
      BEGIN
        SELECT RAISE(ABORT, 'CATEGORY_CHOICE components must have either target_category_id or allowed_product_ids');
      END;
    `);

    // Add BEFORE UPDATE trigger for CATEGORY_CHOICE
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS prevent_invalid_category_choice_update
      BEFORE UPDATE ON deal_components
      FOR EACH ROW
      WHEN NEW.component_type = 'CATEGORY_CHOICE' AND NEW.target_category_id IS NULL AND NEW.allowed_product_ids IS NULL
      BEGIN
        SELECT RAISE(ABORT, 'CATEGORY_CHOICE components must have either target_category_id or allowed_product_ids');
      END;
    `);
  },

  down: (db) => {
    db.exec(`DROP TRIGGER IF EXISTS prevent_null_product_id_insert;`);
    db.exec(`DROP TRIGGER IF EXISTS prevent_null_product_id_update;`);
  }
};
