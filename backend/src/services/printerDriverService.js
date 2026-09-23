import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { escposEncoder } from './escposEncoder.js';
import { SerialPort } from 'serialport';

const execAsync = promisify(exec);

/**
 * PrinterStatus — all possible physical printer states.
 */
export const PrinterStatus = Object.freeze({
  ONLINE:       'ONLINE',
  OFFLINE:      'OFFLINE',
  PRINTING:     'PRINTING',
  BUSY:         'BUSY',
  ERROR:        'ERROR',
  PAPER_OUT:    'PAPER_OUT',
  DISCONNECTED: 'DISCONNECTED',
});

/**
 * PrinterDriverType — supported printer driver backends.
 * VIRTUAL:    logs to console — no hardware required.
 * ESCPOS_USB: ESC/POS via Windows print spooler RAW datatype (winspool.drv).
 * ESCPOS_LAN: ESC/POS over TCP/IP raw socket (port 9100).
 * ESCPOS_BT:  ESC/POS over Bluetooth / Serial COM port.
 */
export const PrinterDriverType = Object.freeze({
  VIRTUAL:    'VIRTUAL',
  ESCPOS_USB: 'ESCPOS_USB',
  ESCPOS_LAN: 'ESCPOS_LAN',
  ESCPOS_BT:  'ESCPOS_BT',
});

// ─────────────────────────────────────────────────────────────────────────────
// RawPrinterHelper C# source — compiled once via PowerShell Add-Type.
// Calls winspool.drv directly: OpenPrinter → StartDocPrinter(RAW) →
// WritePrinter → EndDocPrinter → ClosePrinter.
// No printer sharing required — works with any installed Windows printer.
// ─────────────────────────────────────────────────────────────────────────────
const RAW_PRINTER_CSHARP = `
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOW pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    public static bool SendBytesToPrinter(string printerName, string filePath)
    {
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOW di = new DOCINFOW();
        di.pDocName = "ESC/POS Raw Print Job";
        di.pOutputFile = null;
        di.pDatatype = "RAW";

        bool success = false;

        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
        {
            if (StartDocPrinter(hPrinter, 1, di))
            {
                if (StartPagePrinter(hPrinter))
                {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    try
                    {
                        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                        int written;
                        success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
                    }
                    finally
                    {
                        Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    }
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }

        if (!success)
        {
            int err = Marshal.GetLastWin32Error();
            throw new Exception("WritePrinter failed. Win32 error: " + err + ". Printer: " + printerName);
        }

        return success;
    }
}
`;

/**
 * PrinterDriverService
 *
 * Dispatches print jobs to physical printers via the correct driver backend.
 *
 * Architecture:
 *   - VIRTUAL driver outputs to console (dev/staging)
 *   - ESCPOS_LAN sends raw bytes over TCP socket to ip:port (default 9100)
 *   - ESCPOS_USB sends raw bytes via Windows winspool.drv RawPrinterHelper
 *   - Adding a new printer type never changes the engine
 */
class PrinterDriverService {
  constructor() {
    this._rawPrinterTypeLoaded = false;
  }

  /**
   * Execute a print job on a physical printer.
   *
   * @param {Object} job     - Parsed print job (payload already as Object)
   * @param {Object} printer - Printer config row from DB
   * @returns {Object}       - { success, duration_ms, error? }
   */
  async executePrintJob(job, printer) {
    const startTime = Date.now();
    const driverType = printer?.driver_type || PrinterDriverType.VIRTUAL;

    try {
      switch (driverType) {
        case PrinterDriverType.VIRTUAL:
          await this._executeVirtual(job, printer);
          break;

        case PrinterDriverType.ESCPOS_USB:
          await this._executeEscPosUsb(job, printer);
          break;

        case PrinterDriverType.ESCPOS_LAN:
          await this._executeEscPosLan(job, printer);
          break;

        case PrinterDriverType.ESCPOS_BT:
          await this._executeEscPosBt(job, printer);
          break;

        default:
          // Fallback to virtual — never block printing
          await this._executeVirtual(job, printer);
          break;
      }

      return {
        success:     true,
        duration_ms: Date.now() - startTime,
        driver:      driverType,
      };
    } catch (error) {
      return {
        success:     false,
        duration_ms: Date.now() - startTime,
        driver:      driverType,
        error:       error.message || 'Print execution failed',
      };
    }
  }

  /**
   * Open the cash drawer via ESC/POS pulse command.
   * Sends the real ESC p kick-pulse through the same raw write path.
   */
  async openCashDrawer(printer) {
    const startTime = Date.now();
    const driverType = printer?.driver_type || PrinterDriverType.VIRTUAL;

    try {
      const pin = printer?.cash_drawer_pin ?? 0;

      switch (driverType) {
        case PrinterDriverType.VIRTUAL:
          console.log(`[PrinterDriver][VIRTUAL] 💰 CASH DRAWER OPENED via printer: ${printer?.name || 'Unknown'}`);
          console.log(`[PrinterDriver][VIRTUAL] ESC/POS: ESC p m t1 t2 (pin ${pin})`);
          break;

        case PrinterDriverType.ESCPOS_LAN: {
          const kickBuffer = escposEncoder.encodeCashDrawerKick(pin);
          await this._sendTcp(printer.ip_address, printer.port || 9100, kickBuffer);
          console.log(`[PrinterDriver][LAN] 💰 Cash drawer kick sent to ${printer.ip_address}:${printer.port || 9100}`);
          break;
        }

        case PrinterDriverType.ESCPOS_USB: {
          const kickBuffer = escposEncoder.encodeCashDrawerKick(pin);
          await this._sendUsb(printer, kickBuffer);
          console.log(`[PrinterDriver][USB] 💰 Cash drawer kick sent to ${printer.usb_port || printer.name}`);
          break;
        }

        case PrinterDriverType.ESCPOS_BT: {
          const kickBuffer = escposEncoder.encodeCashDrawerKick(pin);
          await this._sendBt(printer, kickBuffer);
          console.log(`[PrinterDriver][BT] 💰 Cash drawer kick sent to ${printer.connection_string}`);
          break;
        }
      }

      return { success: true, duration_ms: Date.now() - startTime };
    } catch (error) {
      return { success: false, duration_ms: Date.now() - startTime, error: error.message };
    }
  }

  /**
   * Test if a printer is reachable.
   * Returns { reachable, latency_ms, error? }
   */
  async testConnection(printer) {
    const startTime = Date.now();
    const driverType = printer?.driver_type || PrinterDriverType.VIRTUAL;

    if (driverType === PrinterDriverType.VIRTUAL) {
      return { reachable: true, latency_ms: Date.now() - startTime };
    }

    if (driverType === PrinterDriverType.ESCPOS_LAN) {
      return await this._pingLan(printer, startTime);
    }

    if (driverType === PrinterDriverType.ESCPOS_USB) {
      return await this._pingUsb(printer, startTime);
    }

    if (driverType === PrinterDriverType.ESCPOS_BT) {
      return await this._pingBt(printer, startTime);
    }

    return { reachable: true, latency_ms: Date.now() - startTime };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Virtual Driver — console output for development
  // ──────────────────────────────────────────────────────────────────────────

  async _executeVirtual(job, printer) {
    const printerName = printer?.name || 'VIRTUAL';
    const charWidth   = printer?.char_width || 48;
    const separator   = '─'.repeat(charWidth);

    console.log(`\n[PrinterDriver][VIRTUAL] ═══ PRINT JOB: ${job.job_type} ═══`);
    console.log(`[PrinterDriver][VIRTUAL] Printer  : ${printerName}`);
    console.log(`[PrinterDriver][VIRTUAL] Job ID   : ${job.id}`);
    console.log(`[PrinterDriver][VIRTUAL] Order    : ${job.order_number || 'N/A'}`);
    console.log(`[PrinterDriver][VIRTUAL] ${separator}`);

    const payload = job.payload;

    if (payload?.station) {
      console.log(`[PrinterDriver][VIRTUAL] ${this._center(payload.station.station_name || 'KITCHEN', charWidth)}`);
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
    } else if (payload?.business) {
      console.log(`[PrinterDriver][VIRTUAL] ${this._center(payload.business.name || 'RESTAURANT', charWidth)}`);
      if (payload.business.address) console.log(`[PrinterDriver][VIRTUAL] ${this._center(payload.business.address, charWidth)}`);
      if (payload.business.phone)   console.log(`[PrinterDriver][VIRTUAL] ${this._center('Tel: ' + payload.business.phone, charWidth)}`);
      if (payload.business.tax_id)  console.log(`[PrinterDriver][VIRTUAL] ${this._center('TRN: ' + payload.business.tax_id, charWidth)}`);
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
    }

    const o = payload?.order || payload?.order_header;
    if (o) {
      console.log(`[PrinterDriver][VIRTUAL] Order: ${o.order_number}  Date: ${o.business_date}`);
      console.log(`[PrinterDriver][VIRTUAL] Type : ${o.order_type}    Cashier: ${o.cashier_user_id || o.cashier_id}`);
      if (o.table_id) console.log(`[PrinterDriver][VIRTUAL] Table: ${o.table_id}`);
      if (o.notes) console.log(`[PrinterDriver][VIRTUAL] Notes: ${o.notes}`);
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
    }

    if (payload?.items?.length) {
      for (const item of payload.items) {
        const lineTotal = (item.total_amount || item.subtotal || 0).toFixed(2);
        console.log(`[PrinterDriver][VIRTUAL] ${item.quantity}x ${item.product_name} ${this._padLeft(lineTotal, charWidth - item.product_name.length - 4)}`);
        if (item.variant?.variant_name || item.variant?.variant_name_snapshot) {
          console.log(`[PrinterDriver][VIRTUAL]    • ${item.variant.variant_name || item.variant.variant_name_snapshot}`);
        }
        for (const m of item.modifiers || []) {
          console.log(`[PrinterDriver][VIRTUAL]    + ${m.modifier_name}`);
        }
        for (const c of item.combo_components || []) {
          const compName = c.variant_name ? `${c.product_name} [${c.variant_name}]` : c.product_name;
          const qtyPrefix = (c.quantity && c.quantity > 1) ? `${c.quantity} x ` : '1 x ';
          console.log(`[PrinterDriver][VIRTUAL]    Includes: ${qtyPrefix}${compName}`);
        }
        if (item.notes) {
          console.log(`[PrinterDriver][VIRTUAL]    *** ${item.notes} ***`);
        }
      }
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
    }

    if (payload?.financials) {
      const f = payload.financials;
      const sym = f.currency_symbol || 'Rs';
      if (f.discount_total > 0) console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('Discount:', `-${sym} ${f.discount_total.toFixed(2)}`, charWidth)}`);
      console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('Subtotal:', `${sym} ${(f.subtotal || 0).toFixed(2)}`, charWidth)}`);
      console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth(`Tax (${((f.tax_rate || 0) * 100).toFixed(0)}%):`, `${sym} ${(f.tax_total || 0).toFixed(2)}`, charWidth)}`);
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
      console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('TOTAL:', `${sym} ${(f.grand_total || 0).toFixed(2)}`, charWidth)}`);
    }

    if (payload?.payment) {
      const p = payload.payment;
      const sym = payload.financials?.currency_symbol || 'Rs';
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
      console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('Payment:', p.payment_method_label || p.payment_method, charWidth)}`);
      if (p.amount_received > 0) {
        console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('Received:', `${sym} ${(p.amount_received || 0).toFixed(2)}`, charWidth)}`);
        console.log(`[PrinterDriver][VIRTUAL] ${this._padBoth('Change:', `${sym} ${(p.change_returned || 0).toFixed(2)}`, charWidth)}`);
      }
      if (p.transaction_reference) {
        console.log(`[PrinterDriver][VIRTUAL] Ref: ${p.transaction_reference}`);
      }
    }

    if (payload?.footer) {
      console.log(`[PrinterDriver][VIRTUAL] ${separator}`);
      if (payload.footer.text)  console.log(`[PrinterDriver][VIRTUAL] ${this._center(payload.footer.text, charWidth)}`);
      if (payload.footer.show_reprint_label) console.log(`[PrinterDriver][VIRTUAL] ${this._center('*** REPRINT ***', charWidth)}`);
      if (payload.footer.qr?.value)   console.log(`[PrinterDriver][VIRTUAL] [QR: ${payload.footer.qr.value}]`);
      if (payload.footer.barcode?.value) console.log(`[PrinterDriver][VIRTUAL] [BARCODE: ${payload.footer.barcode.value}]`);
    }

    console.log(`[PrinterDriver][VIRTUAL] ═══ END PRINT JOB ═══\n`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ESC/POS LAN Driver — raw TCP socket to printer ip:port
  // ──────────────────────────────────────────────────────────────────────────

  async _executeEscPosLan(job, printer) {
    const ip = printer?.ip_address;
    const port = printer?.port || 9100;

    if (!ip) {
      throw new Error(`LAN printer "${printer?.name}" has no IP address configured.`);
    }

    // Encode the receipt payload into raw ESC/POS bytes
    const buffer = job.job_type === 'KITCHEN_TICKET'
      ? escposEncoder.encodeKitchenTicket(job.payload, printer)
      : escposEncoder.encode(job.payload, printer);

    console.log(`[PrinterDriver][LAN] Sending ${buffer.length} bytes to ${ip}:${port} for job ${job.id}`);

    await this._sendTcp(ip, port, buffer);

    console.log(`[PrinterDriver][LAN] ✅ Job ${job.id} sent successfully to ${ip}:${port}`);
  }

  /**
   * Send a raw byte buffer over TCP to a printer.
   * @param {string} ip      - Printer IP address
   * @param {number} port    - Printer port (default 9100)
   * @param {Buffer} buffer  - Raw ESC/POS bytes
   * @param {number} timeout - Connection timeout in ms (default 5000)
   */
  _sendTcp(ip, port, buffer, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let settled = false;

      const finish = (err) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (err) reject(err);
        else resolve();
      };

      socket.setTimeout(timeout);

      socket.on('timeout', () => {
        finish(new Error(`Printer connection timed out at ${ip}:${port} (${timeout}ms). Check that the printer is powered on and connected to the network.`));
      });

      socket.on('error', (err) => {
        let message;
        if (err.code === 'ECONNREFUSED') {
          message = `Printer offline or unreachable at ${ip}:${port}. Connection refused — verify the printer is powered on and the IP/port are correct.`;
        } else if (err.code === 'ETIMEDOUT') {
          message = `Printer connection timed out at ${ip}:${port}. The printer may be on a different network or subnet.`;
        } else if (err.code === 'EHOSTUNREACH') {
          message = `Printer host unreachable at ${ip}. Check the network configuration and ensure the printer is on the same LAN.`;
        } else {
          message = `Printer communication error at ${ip}:${port}: ${err.message} (${err.code || 'UNKNOWN'})`;
        }
        finish(new Error(message));
      });

      socket.connect(port, ip, () => {
        // Connected — write the buffer, then close cleanly
        socket.write(buffer, (writeErr) => {
          if (writeErr) {
            finish(new Error(`Failed to write to printer at ${ip}:${port}: ${writeErr.message}`));
          } else {
            // End the socket after write completes (half-close)
            socket.end(() => {
              finish(null);
            });
          }
        });
      });
    });
  }

  /**
   * TCP connection test — connect then immediately close.
   */
  async _pingLan(printer, startTime) {
    const ip = printer?.ip_address;
    const port = printer?.port || 9100;

    if (!ip) {
      return { reachable: false, latency_ms: 0, error: 'No IP address configured.' };
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;

      const done = (reachable, error) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({
          reachable,
          latency_ms: Date.now() - startTime,
          error: error || undefined,
        });
      };

      socket.setTimeout(3000);
      socket.on('timeout', () => done(false, `Connection timed out at ${ip}:${port}`));
      socket.on('error', (err) => done(false, `${err.message} (${err.code || 'UNKNOWN'})`));
      socket.connect(port, ip, () => done(true, null));
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ESC/POS USB Driver — Windows winspool.drv via RawPrinterHelper
  //
  // Primary: Embedded C# snippet compiled via PowerShell Add-Type.
  //          Calls winspool.drv directly — no printer sharing required.
  //
  // Fallback: UNC share copy /b (requires manual printer sharing).
  //           Documented as a last resort only.
  // ──────────────────────────────────────────────────────────────────────────

  async _executeEscPosUsb(job, printer) {
    const printerName = printer?.usb_port || printer?.name;

    if (!printerName) {
      throw new Error('USB printer has no usb_port or name configured. Set the Windows printer name in printer settings.');
    }

    // Encode the receipt payload into raw ESC/POS bytes
    const buffer = job.job_type === 'KITCHEN_TICKET'
      ? escposEncoder.encodeKitchenTicket(job.payload, printer)
      : escposEncoder.encode(job.payload, printer);

    console.log(`[PrinterDriver][USB] Sending ${buffer.length} bytes to "${printerName}" for job ${job.id}`);

    await this._sendUsb(printer, buffer);

    console.log(`[PrinterDriver][USB] ✅ Job ${job.id} sent successfully to "${printerName}"`);
  }

  /**
   * Send raw bytes to a USB printer via Windows print spooler.
   *
   * Writes bytes to a temp file, then uses a C# RawPrinterHelper
   * (compiled in-process via PowerShell Add-Type) to call winspool.drv
   * APIs with RAW datatype — bytes are passed completely unmodified.
   *
   * @param {Object} printer - Printer config with usb_port or name
   * @param {Buffer} buffer  - Raw ESC/POS bytes
   */
  async _sendUsb(printer, buffer) {
    const printerName = printer?.usb_port || printer?.name;

    if (!printerName) {
      throw new Error('No Windows printer name configured (usb_port or name required).');
    }

    // Generate unique temp file per job to avoid collisions
    const jobUuid = crypto.randomUUID();
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `escpos_${jobUuid}.bin`);

    try {
      // Write raw bytes to temp file
      fs.writeFileSync(tempFile, buffer);

      // Build PowerShell script that:
      // 1. Compiles the RawPrinterHelper C# type (if not already loaded)
      // 2. Calls SendBytesToPrinter with the printer name and temp file path
      //
      // The C# code uses winspool.drv P/Invoke to send RAW data directly
      // to the printer — no sharing configuration needed.
      const escapedPrinterName = printerName.replace(/'/g, "''");
      const escapedTempFile = tempFile.replace(/'/g, "''");

      const psScript = `
        if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {
          Add-Type -TypeDefinition @'
${RAW_PRINTER_CSHARP}
'@
        }
        [RawPrinterHelper]::SendBytesToPrinter('${escapedPrinterName}', '${escapedTempFile}')
      `;

      await execAsync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`,
        {
          timeout: 15000,  // 15 second timeout
          windowsHide: true
        }
      );
    } catch (error) {
      // Parse PowerShell/winspool errors into clear messages
      const stderr = error.stderr?.toString() || '';
      const stdout = error.stdout?.toString() || '';

      if (stderr.includes('WritePrinter failed') || stdout.includes('WritePrinter failed')) {
        throw new Error(`USB printer "${printerName}" rejected the print job. Verify the printer name matches exactly in Windows Settings > Printers. (${stderr || stdout})`);
      }
      if (stderr.includes('OpenPrinter') || error.message?.includes('OpenPrinter')) {
        throw new Error(`Cannot open USB printer "${printerName}". The printer may not be installed or the name is incorrect. Check Windows Settings > Printers & scanners.`);
      }
      if (error.killed) {
        throw new Error(`USB print job timed out after 15 seconds. The printer "${printerName}" may be offline or busy.`);
      }

      throw new Error(`USB print failed for "${printerName}": ${stderr || error.message}`);
    } finally {
      // Always clean up temp file — even on error
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (cleanupErr) {
        console.warn(`[PrinterDriver][USB] Failed to clean up temp file ${tempFile}: ${cleanupErr.message}`);
      }
    }
  }

  /**
   * USB printer connectivity test.
   * Attempts to open and immediately close the printer via winspool.
   */
  async _pingUsb(printer, startTime) {
    const printerName = printer?.usb_port || printer?.name;
    if (!printerName) {
      return { reachable: false, latency_ms: 0, error: 'No Windows printer name configured.' };
    }

    try {
      const escapedName = printerName.replace(/'/g, "''");
      const psScript = `
        if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {
          Add-Type -TypeDefinition @'
${RAW_PRINTER_CSHARP}
'@
        }
        $ptr = [IntPtr]::Zero
        $ok = [RawPrinterHelper]::OpenPrinter('${escapedName}', [ref]$ptr, [IntPtr]::Zero)
        if ($ok) { [RawPrinterHelper]::ClosePrinter($ptr); Write-Output 'OK' }
        else { Write-Output 'FAIL' }
      `;

      const result = execSync(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"')}"`,
        { timeout: 5000, windowsHide: true, encoding: 'utf8' }
      );

      const reachable = result.trim().includes('OK');
      return {
        reachable,
        latency_ms: Date.now() - startTime,
        error: reachable ? undefined : `Printer "${printerName}" not found in Windows.`,
      };
    } catch (error) {
      return {
        reachable: false,
        latency_ms: Date.now() - startTime,
        error: `Ping failed: ${error.message}`,
      };
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ESC/POS Bluetooth / Serial Driver — via serialport to COM port
  // ──────────────────────────────────────────────────────────────────────────

  async _executeEscPosBt(job, printer) {
    const comPort = printer?.connection_string;

    if (!comPort) {
      throw new Error(`Bluetooth/Serial printer "${printer?.name}" has no COM port configured.`);
    }

    // Encode the receipt payload into raw ESC/POS bytes
    const buffer = job.job_type === 'KITCHEN_TICKET'
      ? escposEncoder.encodeKitchenTicket(job.payload, printer)
      : escposEncoder.encode(job.payload, printer);

    console.log(`[PrinterDriver][BT] Sending ${buffer.length} bytes to ${comPort} for job ${job.id}`);

    await this._sendBt(printer, buffer);

    console.log(`[PrinterDriver][BT] ✅ Job ${job.id} sent successfully to ${comPort}`);
  }

  /**
   * Send a raw byte buffer to a COM port.
   * @param {Object} printer - Printer config
   * @param {Buffer} buffer  - Raw ESC/POS bytes
   */
  _sendBt(printer, buffer) {
    return new Promise((resolve, reject) => {
      const comPort = printer?.connection_string;
      
      if (!comPort) {
        return reject(new Error('No COM port configured for Bluetooth printer.'));
      }

      const port = new SerialPort({
        path: comPort,
        baudRate: 9600, // Standard baud rate, modern BT printers often ignore this anyway
        autoOpen: false,
      });

      // Cleanup function to ensure we always close
      const finish = (err) => {
        if (port.isOpen) {
          port.close((closeErr) => {
            if (closeErr) console.warn(`[PrinterDriver][BT] Error closing port ${comPort}: ${closeErr.message}`);
            if (err) reject(err);
            else resolve();
          });
        } else {
          if (err) reject(err);
          else resolve();
        }
      };

      port.open((err) => {
        if (err) {
          return finish(new Error(`Failed to open ${comPort}: ${err.message}`));
        }

        port.write(buffer, (writeErr) => {
          if (writeErr) {
            return finish(new Error(`Failed to write to ${comPort}: ${writeErr.message}`));
          }
          
          port.drain((drainErr) => {
            if (drainErr) {
              return finish(new Error(`Failed to drain ${comPort}: ${drainErr.message}`));
            }
            finish();
          });
        });
      });
    });
  }

  /**
   * Test Bluetooth/Serial connection by attempting to open the COM port.
   */
  async _pingBt(printer, startTime) {
    const comPort = printer?.connection_string;
    if (!comPort) {
      return { reachable: false, latency_ms: 0, error: 'No COM port configured.' };
    }

    return new Promise((resolve) => {
      const port = new SerialPort({
        path: comPort,
        baudRate: 9600,
        autoOpen: false,
      });

      port.open((err) => {
        if (err) {
          resolve({
            reachable: false,
            latency_ms: Date.now() - startTime,
            error: `Cannot open ${comPort}: ${err.message}`,
          });
        } else {
          port.close(() => {
            resolve({
              reachable: true,
              latency_ms: Date.now() - startTime,
            });
          });
        }
      });
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Text formatting helpers for VIRTUAL output
  // ──────────────────────────────────────────────────────────────────────────

  _center(text, width) {
    const str = String(text || '').slice(0, width);
    const pad = Math.max(0, Math.floor((width - str.length) / 2));
    return ' '.repeat(pad) + str;
  }

  _padLeft(text, totalWidth) {
    const str = String(text || '');
    return str.padStart(totalWidth, ' ');
  }

  _padBoth(left, right, width) {
    const l = String(left  || '');
    const r = String(right || '');
    const gap = Math.max(1, width - l.length - r.length);
    return l + ' '.repeat(gap) + r;
  }
}

export const printerDriverService = new PrinterDriverService();
