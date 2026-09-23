export default {
  version: '026',
  name: 'printer_usb_port',
  disableForeignKeys: false,

  up: (db) => {
    const cols = db.prepare('PRAGMA table_info(printers)').all().map(c => c.name);

    // Add usb_port — the Windows printer name used by the print spooler
    // e.g. "EPSON TM-T88V Receipt", "POS-80", etc.
    if (!cols.includes('usb_port')) {
      db.exec(`ALTER TABLE printers ADD COLUMN usb_port TEXT`);
    }

    // Add codepage — ESC/POS codepage ID for character encoding
    // 0 = CP437 (default), 16 = WPC1252, 19 = CP858
    if (!cols.includes('codepage')) {
      db.exec(`ALTER TABLE printers ADD COLUMN codepage INTEGER NOT NULL DEFAULT 0`);
    }
  },

  down: (db) => {
    console.warn('Manual rollback required for 017_printer_usb_port.');
  }
};
