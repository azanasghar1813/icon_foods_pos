import { configService } from '../services/configService.js';
import { z } from 'zod';
import { zodFirstMessage } from '../utils/zodErrors.js';

const kvSchema = z.record(z.string(), z.coerce.string());

const printerSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  driver_type: z.enum(['ESCPOS_LAN', 'ESCPOS_BT', 'ESCPOS_USB', 'VIRTUAL']).default('ESCPOS_LAN'),
  connection_string: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  port: z.number().int().optional().nullable(),
  paperWidth: z.number().int().default(80),
  isActive: z.boolean().default(true)
});

const paymentMethodSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true)
});

const paymentMethodUpdateSchema = paymentMethodSchema.omit({ code: true });

export const configController = {
  // Aggregate all configs for boot
  getAllConfig: (req, res) => {
    try {
      res.status(200).json({
        data: {
          business: {
            profile: configService.getBusinessProfile(),
            receipt: configService.getReceiptConfig(),
            finance: configService.getFinanceConfig(),
            order: configService.getOrderConfig(),
            product: configService.getProductConfig()
          },
          application: {
            shortcuts: configService.getShortcutConfig(),
            backup: configService.getBackupConfig(),
            sync: configService.getSyncConfig()
          },
          printers: configService.getAllPrinters(),
          paymentMethods: configService.getAllPaymentMethods()
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Update specific business setting category
  updateBusinessCategory: (req, res) => {
    try {
      const category = req.params.category.toUpperCase();
      const parsed = kvSchema.parse(req.body);
      
      configService.updateBusinessCategory(req.user.userId, category, parsed);
      res.status(200).json({ message: `${category} settings updated successfully` });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  // Update specific application setting category
  updateApplicationCategory: (req, res) => {
    try {
      const category = req.params.category.toUpperCase();
      const parsed = kvSchema.parse(req.body);
      
      configService.updateApplicationCategory(req.user.userId, category, parsed);
      res.status(200).json({ message: `${category} settings updated successfully` });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  // Printers CRUD
  discoverPrinters: async (req, res) => {
    try {
      const printers = await configService.discoverPrinters();
      res.status(200).json({ data: printers });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getPrinters: (req, res) => {
    try {
      const printers = configService.getAllPrinters();
      res.status(200).json({ data: printers });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createPrinter: (req, res) => {
    try {
      const parsed = printerSchema.parse(req.body);
      const id = configService.createPrinter(req.user.userId, parsed);
      res.status(201).json({ message: 'Printer created', data: { id } });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  updatePrinter: (req, res) => {
    try {
      const parsed = printerSchema.parse(req.body);
      configService.updatePrinter(req.user.userId, req.params.id, parsed);
      res.status(200).json({ message: 'Printer updated' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  deletePrinter: (req, res) => {
    try {
      configService.deletePrinter(req.user.userId, req.params.id);
      res.status(200).json({ message: 'Printer deleted' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Payment Methods CRUD
  getPaymentMethods: (req, res) => {
    try {
      const methods = configService.getAllPaymentMethods();
      res.status(200).json({ data: methods });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createPaymentMethod: (req, res) => {
    try {
      const parsed = paymentMethodSchema.parse(req.body);
      const code = configService.createPaymentMethod(req.user.userId, parsed);
      res.status(201).json({ message: 'Payment method created', data: { code } });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  updatePaymentMethod: (req, res) => {
    try {
      const parsed = paymentMethodUpdateSchema.parse(req.body);
      configService.updatePaymentMethod(req.user.userId, req.params.code, parsed);
      res.status(200).json({ message: 'Payment method updated' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  deletePaymentMethod: (req, res) => {
    try {
      configService.deletePaymentMethod(req.user.userId, req.params.code);
      res.status(200).json({ message: 'Payment method deleted' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};
