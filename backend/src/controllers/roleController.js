import { roleService } from '../services/roleService.js';
import { z } from 'zod';
import { zodFirstMessage } from '../utils/zodErrors.js';

const roleSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()).optional()
});

export const roleController = {
  getAll: (req, res) => {
    try {
      const roles = roleService.getAllRoles();
      res.status(200).json({ data: roles });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getById: (req, res) => {
    try {
      const role = roleService.getRoleById(req.params.id);
      res.status(200).json({ data: role });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  },

  create: (req, res) => {
    try {
      const parsed = roleSchema.parse(req.body);
      const roleId = roleService.createRole(req.user.userId, parsed.name, parsed.description, parsed.permissionIds);
      res.status(201).json({ message: 'Role created', data: { id: roleId } });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  update: (req, res) => {
    try {
      const parsed = roleSchema.parse(req.body);
      roleService.updateRole(req.user.userId, req.params.id, parsed.name, parsed.description, parsed.permissionIds);
      res.status(200).json({ message: 'Role updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  delete: (req, res) => {
    try {
      roleService.deleteRole(req.user.userId, req.params.id);
      res.status(200).json({ message: 'Role deleted successfully' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};
