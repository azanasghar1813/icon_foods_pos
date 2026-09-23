import iconv from 'iconv-lite';
import { formatReceiptOrderNumber } from '../utils/receiptOrderNumber.js';

/**
 * ESC/POS Byte Encoder
 *
 * Converts a receipt JSON payload into raw ESC/POS binary commands
 * suitable for direct transmission to thermal printers over TCP or
 * the Windows print spooler RAW datatype.
 *
 * Character encoding: All text is converted from JavaScript's internal
 * UTF-16 to the target codepage (default CP437) via iconv-lite BEFORE
 * being written into the buffer. The ESC t command is also sent so the
 * printer interprets the bytes correctly.
 *
 * Supported codepages:
 *   0 = PC437 (US)          — default, good for ASCII + basic symbols
 *  16 = WPC1252 (Windows)   — Western European
 *  19 = CP858 (Euro variant of CP850)
 *
 * QR and barcode commands follow the generic ESC/POS spec. Brand-specific
 * parameter variations should be verified against real hardware output.
 */

// ─────────────────────────────────────────────────────────────────────────────
// ESC/POS Command Constants
// ─────────────────────────────────────────────────────────────────────────────

const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

// Codepage mapping: ESC/POS codepage ID → iconv encoding name
const CODEPAGE_MAP = {
  0:  'cp437',     // PC437 (US)
  2:  'cp850',     // PC850 (Multilingual)
  16: 'cp1252',    // WPC1252 (Windows Latin-1)
  19: 'cp858',     // CP858 (Euro variant)
};

class EscPosEncoder {
  constructor() {
    /**
     * Default codepage. Override per-printer via printerConfig.codepage.
     * 0 = CP437 is the universal default for thermal receipt printers.
     */
    this.defaultCodepage = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Encode a full receipt payload into raw ESC/POS bytes.
   *
   * @param {Object} payload       - Receipt payload (business, items, financials, payment, footer)
   * @param {Object} printerConfig - Printer row from DB (char_width, codepage, cash_drawer_pin, etc.)
   * @returns {Buffer}             - Raw bytes ready for TCP write or spooler
   */
  encode(payload, printerConfig = {}) {
    const charWidth = printerConfig.char_width || 48;
    const codepageId = printerConfig.codepage ?? this.defaultCodepage;
    const iconvEncoding = CODEPAGE_MAP[codepageId] || 'cp437';

    const parts = [];

    // ── Initialize printer ────────────────────────────────────────────────
    parts.push(this._cmd(ESC, 0x40));               // ESC @ — initialize
    parts.push(this._cmd(ESC, 0x74, codepageId));    // ESC t n — select codepage

    // ── Business header ───────────────────────────────────────────────────
    if (payload.business) {
      const biz = payload.business;

      parts.push(this._align('center'));
      parts.push(this._doubleSize(true));
      parts.push(this._encodeText(biz.name || 'RESTAURANT', iconvEncoding));
      parts.push(this._lf());
      parts.push(this._doubleSize(false));

      if (biz.branch) {
        parts.push(this._bold(true));
        parts.push(this._encodeText(biz.branch, iconvEncoding));
        parts.push(this._lf());
        parts.push(this._bold(false));
      }
      if (biz.address) {
        for (const line of String(biz.address).split(/\r?\n/)) {
          if (!line.trim()) continue;
          parts.push(this._encodeText(line, iconvEncoding));
          parts.push(this._lf());
        }
      }
      if (biz.phone) {
        parts.push(this._bold(true));
        parts.push(this._encodeText('Contact: ' + biz.phone, iconvEncoding));
        parts.push(this._lf());
        parts.push(this._bold(false));
      }
      if (biz.tax_id) {
        parts.push(this._encodeText('TRN: ' + biz.tax_id, iconvEncoding));
        parts.push(this._lf());
      }
      parts.push(this._separator(charWidth, iconvEncoding));
    }

    // ── Order info ────────────────────────────────────────────────────────
    if (payload.order) {
      const o = payload.order;
      parts.push(this._align('left'));
      parts.push(this._bold(true));
      parts.push(this._tall(true));
      parts.push(this._encodeText(formatReceiptOrderNumber(o.order_number), iconvEncoding));
      parts.push(this._lf());
      parts.push(this._tall(false));
      parts.push(this._bold(false));
      parts.push(this._encodeText(`Type : ${o.order_type || ''}`, iconvEncoding));
      parts.push(this._lf());
      const isDineIn = String(o.order_type || '').toUpperCase().includes('DINE');
      const tableLabel = isDineIn ? (o.table_number || o.table_id) : null;
      if (tableLabel) {
        parts.push(this._encodeText(`Table: ${tableLabel}`, iconvEncoding));
        parts.push(this._lf());
      }
      parts.push(this._encodeText(`Customer: ${o.customer_name || 'Guest'}`, iconvEncoding));
      parts.push(this._lf());
      if (o.customer_phone) {
        parts.push(this._bold(true));
        parts.push(this._tall(true));
        parts.push(this._encodeText(`Phone: ${o.customer_phone}`, iconvEncoding));
        parts.push(this._lf());
        parts.push(this._tall(false));
        parts.push(this._bold(false));
      }
      if (o.customer_address) {
        for (const line of String(o.customer_address).split(/\r?\n/)) {
          if (!line.trim()) continue;
          parts.push(this._encodeText(line, iconvEncoding));
          parts.push(this._lf());
        }
      }
      if (o.waiter_name) {
        parts.push(this._encodeText(`Waiter: ${o.waiter_name}`, iconvEncoding));
        parts.push(this._lf());
      }
      if (o.rider_name) {
        parts.push(this._encodeText(`Rider: ${o.rider_name}`, iconvEncoding));
        parts.push(this._lf());
      }
      const paidLabel = o.receipt_paid_stamp ? 'Paid' : 'Unpaid';
      parts.push(this._encodeText(`Status: ${paidLabel}`, iconvEncoding));
      parts.push(this._lf());
      if (o.payment_method && String(o.payment_method).toUpperCase() !== 'UNPAID' && String(o.payment_method).toUpperCase() !== 'LATER') {
        parts.push(this._encodeText(`Pay: ${o.payment_method}`, iconvEncoding));
        parts.push(this._lf());
      }
      const { date, time } = this._receiptDateTime(o);
      parts.push(this._bold(true));
      parts.push(this._tall(true));
      if (date) {
        parts.push(this._encodeText(`Date : ${date}`, iconvEncoding));
        parts.push(this._lf());
      }
      if (time) {
        parts.push(this._encodeText(`Time : ${time}`, iconvEncoding));
        parts.push(this._lf());
      }
      parts.push(this._tall(false));
      parts.push(this._bold(false));
      const cashierLabel = o.cashier_name || null;
      if (cashierLabel) {
        parts.push(this._encodeText(`Cashier: ${cashierLabel}`, iconvEncoding));
        parts.push(this._lf());
      }
      const orderNotes = o.notes || payload.notes;
      if (orderNotes) {
        parts.push(this._encodeText(`NOTE: ${orderNotes}`, iconvEncoding));
        parts.push(this._lf());
      }
      parts.push(this._separator(charWidth, iconvEncoding));
    }

    // ── VIP Badge ─────────────────────────────────────────────────────────
    if (payload.order && (payload.order.is_vip === true || payload.order.is_vip === 'true' || payload.order.is_vip === 1)) {
      parts.push(this._align('center'));
      parts.push(this._bold(true));
      parts.push(this._encodeText('*** VIP ORDER ***', iconvEncoding));
      parts.push(this._lf());
      parts.push(this._bold(false));
      parts.push(this._separator(charWidth, iconvEncoding));
    }

    // ── Reprint label ─────────────────────────────────────────────────────
    if (payload.is_reprint || payload.footer?.show_reprint_label) {
      parts.push(this._align('center'));
      parts.push(this._bold(true));
      parts.push(this._doubleSize(true));
      parts.push(this._encodeText('*** REPRINT ***', iconvEncoding));
      parts.push(this._lf());
      parts.push(this._doubleSize(false));
      parts.push(this._bold(false));
      parts.push(this._separator(charWidth, iconvEncoding));
    }

    // ── Line items ────────────────────────────────────────────────────────
    if (payload.items?.length) {
      parts.push(this._align('left'));

      // Column header
      parts.push(this._bold(true));
      parts.push(this._encodeText(
        this._padBoth('Item', 'Amount', charWidth),
        iconvEncoding
      ));
      parts.push(this._lf());
      parts.push(this._bold(false));
      parts.push(this._thinSeparator(charWidth, iconvEncoding));

      for (const item of payload.items) {
        const name = item.product_name || 'Unknown';
        const qty = item.quantity || 1;
        const total = (item.total_amount ?? item.subtotal ?? 0).toFixed(2);
        const qtyName = `${qty}x ${name}`;

        parts.push(this._encodeText(
          this._padBoth(qtyName.slice(0, charWidth - total.length - 2), total, charWidth),
          iconvEncoding
        ));
        parts.push(this._lf());

        // Variant
        if (item.variant?.variant_name || item.variant?.variant_name_snapshot) {
          parts.push(this._encodeText(`   > ${item.variant.variant_name || item.variant.variant_name_snapshot}`, iconvEncoding));
          parts.push(this._lf());
        }

        // Modifiers
        for (const m of item.modifiers || []) {
          const modPrice = m.price_adj ? ` +${m.price_adj.toFixed(2)}` : '';
          parts.push(this._encodeText(`   + ${m.modifier_name}${modPrice}`, iconvEncoding));
          parts.push(this._lf());
        }

        // Addons
        for (const a of item.addons || []) {
          const addonTotal = (a.subtotal || 0).toFixed(2);
          parts.push(this._encodeText(`   + ${a.addon_name} ${addonTotal}`, iconvEncoding));
          parts.push(this._lf());
        }

        // Combo components
        for (const c of item.combo_components || []) {
          const compName = c.variant_name ? `${c.product_name} [${c.variant_name}]` : c.product_name;
          const qtyPrefix = (c.quantity && c.quantity > 1) ? `${c.quantity}x ` : '';
          parts.push(this._encodeText(`   Incl: ${qtyPrefix}${compName}`, iconvEncoding));
          parts.push(this._lf());
        }

        // Item notes
        if (item.notes) {
          parts.push(this._encodeText(`   *** ${item.notes} ***`, iconvEncoding));
          parts.push(this._lf());
        }
      }

      parts.push(this._separator(charWidth, iconvEncoding));
    }

    // ── Financials ────────────────────────────────────────────────────────
    if (payload.financials) {
      const f = payload.financials;
      const sym = f.currency_symbol || 'Rs';

      parts.push(this._align('right'));

      if (f.discount_total > 0) {
        parts.push(this._align('left'));
        parts.push(this._encodeText(
          this._padBoth('Discount:', `-${sym} ${f.discount_total.toFixed(2)}`, charWidth),
          iconvEncoding
        ));
        parts.push(this._lf());
      }

      parts.push(this._align('left'));
      parts.push(this._encodeText(
        this._padBoth('Subtotal:', `${sym} ${(f.subtotal || 0).toFixed(2)}`, charWidth),
        iconvEncoding
      ));
      parts.push(this._lf());

      if (Number(f.tax_total) > 0) {
        const taxPct = ((f.tax_rate || 0) * 100).toFixed(0);
        const taxLabel = f.tax_name || 'VAT';
        parts.push(this._encodeText(
          this._padBoth(`${taxLabel} (${taxPct}%):`, `${sym} ${(f.tax_total || 0).toFixed(2)}`, charWidth),
          iconvEncoding
        ));
        parts.push(this._lf());
      }

      const serviceCharge = Number(f.service_charge) || 0;
      if (serviceCharge > 0) {
        parts.push(this._encodeText(
          this._padBoth('Service Charges:', `${sym} ${serviceCharge.toFixed(2)}`, charWidth),
          iconvEncoding
        ));
        parts.push(this._lf());
      }

      if (f.delivery_fee > 0) {
        parts.push(this._encodeText(
          this._padBoth('Delivery:', `${sym} ${f.delivery_fee.toFixed(2)}`, charWidth),
          iconvEncoding
        ));
        parts.push(this._lf());
      }

      parts.push(this._separator(charWidth, iconvEncoding));

      // Grand total — large and bold
      parts.push(this._align('center'));
      parts.push(this._bold(true));
      parts.push(this._doubleSize(true));
      parts.push(this._encodeText(`${sym} ${(f.grand_total || 0).toFixed(2)}`, iconvEncoding));
      parts.push(this._lf());
      parts.push(this._doubleSize(false));
      parts.push(this._bold(false));
    }

    // ── Payment ───────────────────────────────────────────────────────────
    if (payload.payment) {
      const p = payload.payment;
      const sym = payload.financials?.currency_symbol || 'Rs';

      parts.push(this._separator(charWidth, iconvEncoding));
      parts.push(this._align('left'));

      parts.push(this._encodeText(
        this._padBoth('Payment:', p.payment_method_label || p.payment_method || '', charWidth),
        iconvEncoding
      ));
      parts.push(this._lf());

      if (p.amount_received > 0) {
        parts.push(this._encodeText(
          this._padBoth('Received:', `${sym} ${(p.amount_received || 0).toFixed(2)}`, charWidth),
          iconvEncoding
        ));
        parts.push(this._lf());
        parts.push(this._encodeText(
          this._padBoth('Change:', `${sym} ${(p.change_returned || 0).toFixed(2)}`, charWidth),
          iconvEncoding
        ));
        parts.push(this._lf());
      }

      if (p.transaction_reference) {
        parts.push(this._encodeText(`Ref: ${p.transaction_reference}`, iconvEncoding));
        parts.push(this._lf());
      }
    }

    // ── Footer ────────────────────────────────────────────────────────────
    if (payload.footer) {
      parts.push(this._separator(charWidth, iconvEncoding));
      parts.push(this._align('center'));

      if (payload.footer.text) {
        parts.push(this._encodeText(payload.footer.text, iconvEncoding));
        parts.push(this._lf());
      }

      // QR Code
      if (payload.footer.qr?.value) {
        parts.push(this._lf());
        parts.push(this._encodeQrCode(payload.footer.qr.value));
      }

      // Barcode
      if (payload.footer.barcode?.value) {
        parts.push(this._lf());
        parts.push(this._encodeBarcode128(payload.footer.barcode.value, iconvEncoding));
      }
    }

    // ── Final line feeds + paper cut ──────────────────────────────────────
    parts.push(this._lf());
    parts.push(this._align('center'));
    parts.push(this._encodeText('Powered By : corevex.tech (-_-)', iconvEncoding));
    parts.push(this._lf());
    parts.push(this._lf());
    parts.push(this._lf());

    if (printerConfig.auto_cut !== false && printerConfig.auto_cut !== 0) {
      parts.push(this._paperCut());
    }

    // ── Cash drawer kick (if requested in payload.printer) ───────────────
    if (payload.printer?.cash_drawer) {
      const pin = printerConfig.cash_drawer_pin ?? 0;
      parts.push(this._cashDrawerKick(pin));
    }

    return Buffer.concat(parts);
  }

  /**
   * Encode a kitchen ticket payload into raw ESC/POS bytes.
   */
  encodeKitchenTicket(payload, printerConfig = {}) {
    const charWidth = printerConfig.char_width || 48;
    const codepageId = printerConfig.codepage ?? this.defaultCodepage;
    const iconvEncoding = CODEPAGE_MAP[codepageId] || 'cp437';
    const parts = [];

    parts.push(this._cmd(ESC, 0x40));
    parts.push(this._cmd(ESC, 0x74, codepageId));

    // Station + order header — using the ACTUAL kitchen payload shape
    parts.push(this._align('center'));
    parts.push(this._doubleSize(true));
    parts.push(this._bold(true));
    parts.push(this._encodeText('KITCHEN TICKET', iconvEncoding));
    parts.push(this._lf());
    parts.push(this._doubleSize(false));
    parts.push(this._bold(false));

    const oh = payload.order_header || {};
    parts.push(this._align('left'));
    parts.push(this._bold(true));
    parts.push(this._tall(true));
    parts.push(this._encodeText(formatReceiptOrderNumber(oh.order_number), iconvEncoding));
    parts.push(this._lf());
    parts.push(this._tall(false));
    parts.push(this._bold(false));
    const kotIsDineIn = String(oh.order_type || '').toUpperCase().includes('DINE');
    const kotTable = kotIsDineIn ? (oh.table_number || oh.table_id) : null;
    if (kotTable) {
      parts.push(this._encodeText(`Table: ${kotTable}`, iconvEncoding));
      parts.push(this._lf());
    }
    parts.push(this._encodeText(`Type : ${oh.order_type || ''}`, iconvEncoding));
    parts.push(this._lf());
    if (oh.waiter_name) {
      parts.push(this._encodeText(`Waiter: ${oh.waiter_name}`, iconvEncoding));
      parts.push(this._lf());
    }
    if (oh.rider_name) {
      parts.push(this._encodeText(`Rider: ${oh.rider_name}`, iconvEncoding));
      parts.push(this._lf());
    }
    if (oh.is_vip) {
      parts.push(this._bold(true));
      parts.push(this._encodeText('** VIP ORDER **', iconvEncoding));
      parts.push(this._lf());
      parts.push(this._bold(false));
    }
    if (oh.notes) {
      parts.push(this._encodeText(`Notes: ${oh.notes}`, iconvEncoding));
      parts.push(this._lf());
    }
    parts.push(this._separator(charWidth, iconvEncoding));

    // Items — respecting config.show_prices
    for (const item of payload.items || []) {
      parts.push(this._doubleSize(!!payload.config?.large_font));
      parts.push(this._encodeText(`${item.quantity}x ${item.product_name}`, iconvEncoding));
      parts.push(this._doubleSize(false));
      parts.push(this._lf());

      if (item.variant?.variant_name || item.variant?.variant_name_snapshot) {
        parts.push(this._encodeText(`   > ${item.variant.variant_name || item.variant.variant_name_snapshot}`, iconvEncoding));
        parts.push(this._lf());
      }
      for (const m of item.modifiers || []) {
        parts.push(this._encodeText(`   + ${m.modifier_name}`, iconvEncoding));
        parts.push(this._lf());
      }
      for (const a of item.addons || []) {
        parts.push(this._encodeText(`   + ${a.addon_name}${a.quantity > 1 ? ` x${a.quantity}` : ''}`, iconvEncoding));
        parts.push(this._lf());
      }
      for (const c of item.combo_components || []) {
        const qtyPrefix = (c.quantity && c.quantity > 1) ? `${c.quantity}x ` : '';
        parts.push(this._encodeText(`   Incl: ${qtyPrefix}${c.product_name}${c.variant_name ? ` [${c.variant_name}]` : ''}`, iconvEncoding));
        parts.push(this._lf());
      }
      if (item.notes) {
        parts.push(this._encodeText(`   *** ${item.notes} ***`, iconvEncoding));
        parts.push(this._lf());
      }
    }

    parts.push(this._lf()); parts.push(this._lf());
    if (printerConfig.auto_cut !== false && printerConfig.auto_cut !== 0) {
      parts.push(this._paperCut());
    }

    return Buffer.concat(parts);
  }

  /**
   * Encode a standalone cash drawer kick pulse.
   * @param {number} pin - Drawer pin: 0 (pin 2) or 1 (pin 5)
   * @returns {Buffer}
   */
  encodeCashDrawerKick(pin = 0) {
    return Buffer.concat([
      this._cmd(ESC, 0x40),         // Initialize first (safe)
      this._cashDrawerKick(pin),
    ]);
  }

  /**
   * Encode a test page for printer connectivity verification.
   * @param {string} printerName
   * @param {Object} printerConfig
   * @returns {Buffer}
   */
  encodeTestPage(printerName, printerConfig = {}) {
    const charWidth = printerConfig.char_width || 48;
    const codepageId = printerConfig.codepage ?? this.defaultCodepage;
    const iconvEncoding = CODEPAGE_MAP[codepageId] || 'cp437';

    const parts = [];
    parts.push(this._cmd(ESC, 0x40));
    parts.push(this._cmd(ESC, 0x74, codepageId));

    parts.push(this._align('center'));
    parts.push(this._doubleSize(true));
    parts.push(this._bold(true));
    parts.push(this._encodeText('PRINTER TEST', iconvEncoding));
    parts.push(this._lf());
    parts.push(this._doubleSize(false));
    parts.push(this._bold(false));

    parts.push(this._separator(charWidth, iconvEncoding));
    parts.push(this._align('left'));
    parts.push(this._encodeText(`Printer: ${printerName}`, iconvEncoding));
    parts.push(this._lf());
    parts.push(this._encodeText(`Time: ${new Date().toISOString()}`, iconvEncoding));
    parts.push(this._lf());
    parts.push(this._encodeText(`Char Width: ${charWidth}`, iconvEncoding));
    parts.push(this._lf());
    parts.push(this._encodeText(`Codepage: ${codepageId} (${iconvEncoding})`, iconvEncoding));
    parts.push(this._lf());
    parts.push(this._separator(charWidth, iconvEncoding));

    // Print encoding test characters
    parts.push(this._align('center'));
    parts.push(this._encodeText('Encoding Test:', iconvEncoding));
    parts.push(this._lf());
    parts.push(this._encodeText('AED Rs. EUR 0123456789', iconvEncoding));
    parts.push(this._lf());
    parts.push(this._encodeText('ABCDEFGHIJKLMNOPQRSTUVWXYZ', iconvEncoding));
    parts.push(this._lf());
    parts.push(this._encodeText('abcdefghijklmnopqrstuvwxyz', iconvEncoding));
    parts.push(this._lf());
    parts.push(this._encodeText('!@#$%^&*()-_=+[]{}|;:,.<>?', iconvEncoding));
    parts.push(this._lf());

    parts.push(this._separator(charWidth, iconvEncoding));
    parts.push(this._encodeText('OK — Printer is working', iconvEncoding));
    parts.push(this._lf());
    parts.push(this._lf());
    parts.push(this._lf());

    if (printerConfig.auto_cut !== false && printerConfig.auto_cut !== 0) {
      parts.push(this._paperCut());
    }

    return Buffer.concat(parts);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ESC/POS Command Builders (private)
  // ──────────────────────────────────────────────────────────────────────────

  /** Build a raw command buffer from individual bytes. */
  _cmd(...bytes) {
    return Buffer.from(bytes);
  }

  /** Line feed. */
  _lf() {
    return Buffer.from([LF]);
  }

  /**
   * Encode a text string into the target codepage bytes.
   * This is the REAL encoding step — iconv converts each character
   * from UTF-16 into the actual byte value for the codepage.
   * Characters not representable in the codepage are replaced with '?'.
   */
  _encodeText(text, encoding = 'cp437') {
    if (!text) return Buffer.alloc(0);
    return iconv.encode(String(text), encoding);
  }

  /** ESC a n — Set alignment. */
  _align(alignment) {
    const map = { left: 0, center: 1, right: 2 };
    return this._cmd(ESC, 0x61, map[alignment] ?? 0);
  }

  /** ESC E n — Bold on/off. */
  _bold(on) {
    return this._cmd(ESC, 0x45, on ? 1 : 0);
  }

  /** GS ! n — Double height + width. */
  _doubleSize(on) {
    // 0x00 = normal, 0x11 = double width + double height
    return this._cmd(GS, 0x21, on ? 0x11 : 0x00);
  }

  /** GS ! n — Double height only (slightly larger, same width). */
  _tall(on) {
    return this._cmd(GS, 0x21, on ? 0x01 : 0x00);
  }

  _receiptDateTime(order) {
    const raw = order?.created_at || order?.paid_at;
    let d = null;
    if (raw) {
      const s = String(raw);
      d = (s.includes('T') || s.includes('Z') || s.includes('+'))
        ? new Date(s)
        : new Date(s.replace(' ', 'T') + 'Z');
    }
    if (d && !Number.isNaN(d.getTime())) {
      return {
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
    }
    return { date: order?.business_date || '', time: '' };
  }

  /** GS V 66 n — Partial cut with n lines feed. */
  _paperCut() {
    return this._cmd(GS, 0x56, 0x42, 0x03);
  }

  /**
   * ESC p m t1 t2 — Cash drawer kick pulse.
   * m: 0 = pin 2 (most common), 1 = pin 5
   * t1: on-time  (25 × 2ms = 50ms)
   * t2: off-time (250 × 2ms = 500ms)
   */
  _cashDrawerKick(pin = 0) {
    return this._cmd(ESC, 0x70, pin === 1 ? 0x01 : 0x00, 0x19, 0xFA);
  }

  /** Full-width separator line. */
  _separator(charWidth, encoding = 'cp437') {
    // Use dashes — these exist in every codepage
    const line = '-'.repeat(charWidth);
    return Buffer.concat([
      this._encodeText(line, encoding),
      this._lf(),
    ]);
  }

  /** Thin dotted separator. */
  _thinSeparator(charWidth, encoding = 'cp437') {
    const line = '.'.repeat(charWidth);
    return Buffer.concat([
      this._encodeText(line, encoding),
      this._lf(),
    ]);
  }

  /** Pad text left + right within a fixed width. */
  _padBoth(left, right, width) {
    const l = String(left || '');
    const r = String(right || '');
    const gap = Math.max(1, width - l.length - r.length);
    return l + ' '.repeat(gap) + r;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // QR Code (generic ESC/POS GS ( k family)
  //
  // NOTE: These follow the generic Epson-compatible ESC/POS spec.
  // Brand-specific printers (Star, Bixolon, etc.) may have variations
  // in parameters. Verify against real hardware output.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Encode a QR code using the GS ( k command family.
   * @param {string} data - The string to encode in the QR code
   * @returns {Buffer}
   */
  _encodeQrCode(data) {
    if (!data) return Buffer.alloc(0);

    const dataBytes = Buffer.from(data, 'ascii');
    const dataLen = dataBytes.length;
    const parts = [];

    // 1. Select QR model 2
    //    GS ( k pL pH cn fn n1 n2
    //    cn=49 (QR), fn=65 (select model), n1=50 (model 2), n2=0
    parts.push(Buffer.from([GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]));

    // 2. Set QR module size (dot size = 4)
    //    cn=49, fn=67, n=4
    parts.push(Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x04]));

    // 3. Set QR error correction level (L = 48, M = 49, Q = 50, H = 51)
    //    cn=49, fn=69, n=49 (M — 15% recovery)
    parts.push(Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]));

    // 4. Store QR data
    //    cn=49, fn=80, m=48, then data bytes
    //    pL pH = (dataLen + 3) as little-endian 16-bit
    const storeLen = dataLen + 3;
    const pL = storeLen & 0xFF;
    const pH = (storeLen >> 8) & 0xFF;
    parts.push(Buffer.from([GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30]));
    parts.push(dataBytes);

    // 5. Print the stored QR code
    //    cn=49, fn=81, m=48
    parts.push(Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]));

    return Buffer.concat(parts);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Barcode CODE128
  //
  // NOTE: Same brand-verification caveat as QR codes.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Encode a CODE128 barcode.
   * @param {string} data - Barcode data string
   * @param {string} encoding - iconv encoding for HRI text
   * @returns {Buffer}
   */
  _encodeBarcode128(data, encoding = 'cp437') {
    if (!data) return Buffer.alloc(0);

    const parts = [];

    // Set barcode height (80 dots)
    parts.push(this._cmd(GS, 0x68, 50));

    // Set barcode width (module width = 2)
    parts.push(this._cmd(GS, 0x77, 0x02));

    // Set HRI (human-readable interpretation) position: below barcode
    parts.push(this._cmd(GS, 0x48, 0x02));

    // Set HRI font: Font A
    parts.push(this._cmd(GS, 0x66, 0x00));

    // Print CODE128 barcode
    // GS k m n data...
    // m = 73 (CODE128), n = data length
    const barcodeContent = `{B${data}`;
    const dataBytes = iconv.encode(barcodeContent, encoding);
    parts.push(this._cmd(GS, 0x6B, 73, dataBytes.length));
    parts.push(dataBytes);

    return Buffer.concat(parts);
  }
}

export const escposEncoder = new EscPosEncoder();
