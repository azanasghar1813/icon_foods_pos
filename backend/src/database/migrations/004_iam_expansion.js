export default {
  version: '004',
  name: 'iam_expansion',

  up: (db) => {
    db.exec(`
      ALTER TABLE users ADD COLUMN profile_photo TEXT;
    `);
    
    db.exec(`
      ALTER TABLE users ADD COLUMN phone TEXT;
    `);

    db.exec(`
      ALTER TABLE users ADD COLUMN email TEXT;
    `);

    db.exec(`
      ALTER TABLE users ADD COLUMN joining_date DATETIME;
    `);
  },

  down: (db) => {
    console.warn('Manual rollback required for 004_iam_expansion.');
  }
};
