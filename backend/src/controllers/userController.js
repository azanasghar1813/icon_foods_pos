import { userService } from '../services/userService.js';
import { z } from 'zod';
import { zodFirstMessage } from '../utils/zodErrors.js';

const userCreateSchema = z.object({
  username: z.string().min(3),
  roleId: z.string().uuid(),
  pinCode: z.string().min(4),
  password: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  joiningDate: z.string().optional(),
  showOnLogin: z.boolean().optional()
});

const userUpdateSchema = z.object({
  username: z.string().min(3),
  roleId: z.string().uuid(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  showOnLogin: z.boolean().optional()
});

const statusSchema = z.object({
  isActive: z.boolean()
});

const resetPinSchema = z.object({
  newPin: z.string().min(4)
});

const changePinSchema = z.object({
  oldPin: z.string().min(4),
  newPin: z.string().min(4)
});

export const userController = {
  getAll: (req, res) => {
    try {
      const users = userService.getAllUsers();
      res.status(200).json({ data: users });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getDirectory: (req, res) => {
    try {
      const users = userService.getAllUsers().map((u) => ({
        id: u.id,
        username: u.username,
        first_name: u.first_name,
        last_name: u.last_name,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username,
        role_name: u.role_name,
        is_active: u.is_active
      }));
      res.status(200).json({ data: users });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getById: (req, res) => {
    try {
      const user = userService.getUserById(req.params.id);
      res.status(200).json({ data: user });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  },

  create: (req, res) => {
    try {
      const parsed = userCreateSchema.parse(req.body);
      const userId = userService.createUser(req.user.userId, parsed);
      res.status(201).json({ message: 'User created successfully', data: { id: userId } });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  update: (req, res) => {
    try {
      const parsed = userUpdateSchema.parse(req.body);
      userService.updateUserProfile(req.user.userId, req.params.id, parsed);
      res.status(200).json({ message: 'User updated successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  updateStatus: (req, res) => {
    try {
      const parsed = statusSchema.parse(req.body);
      userService.updateUserStatus(req.user.userId, req.params.id, parsed.isActive);
      res.status(200).json({ message: 'User status updated' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  resetPin: (req, res) => {
    try {
      const parsed = resetPinSchema.parse(req.body);
      userService.resetUserPin(req.user.userId, req.params.id, parsed.newPin);
      res.status(200).json({ message: 'User PIN reset successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },
  
  changeMyPin: (req, res) => {
    try {
      const parsed = changePinSchema.parse(req.body);
      userService.changeMyPin(req.user.userId, parsed.oldPin, parsed.newPin);
      res.status(200).json({ message: 'PIN changed successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: zodFirstMessage(error) });
      res.status(400).json({ error: error.message });
    }
  },

  uploadPhoto: (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Store relative path in DB (e.g., 'images/users/user_uuid.jpg')
      // Note: In a real app we might want a utility to map the absolute path returned by multer to a relative URL
      const relativePath = `images/users/${req.file.filename}`;
      userService.updateProfilePhoto(req.user.userId, req.params.id, relativePath);
      
      res.status(200).json({ message: 'Profile photo uploaded successfully', data: { path: relativePath } });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};
