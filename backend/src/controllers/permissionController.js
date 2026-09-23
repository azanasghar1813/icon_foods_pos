import { permissionService } from '../services/permissionService.js';

export const permissionController = {
  getAll: (req, res) => {
    try {
      const module = req.query.module;
      const permissions = module 
        ? permissionService.getPermissionsByModule(module)
        : permissionService.getAllPermissions();
        
      res.status(200).json({ data: permissions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};
