import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as categoryController from '../controllers/categoryController.js';
import * as productController from '../controllers/productController.js';
import * as dealController from '../controllers/dealController.js';
import { variantController } from '../controllers/variantController.js';
import { modifierController } from '../controllers/modifierController.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storageManager } from '../utils/storageManager.js';

import { validate } from '../middleware/validationMiddleware.js';
import { productCreateSchema, productUpdateSchema } from '../validation/productSchema.js';
import { categoryCreateSchema, categoryUpdateSchema } from '../validation/categorySchema.js';

const router = Router();

// Multer Setup for temporary uploads
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = storageManager.getPath('temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `upload_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage: tempStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only JPEG, PNG, and WEBP are allowed.'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Apply authentication to all catalog routes
router.use(authenticate);

// --- Categories ---
router.get('/categories', categoryController.getCategories);
router.get('/categories/:id', categoryController.getCategoryById);
router.post('/categories', authorize('MANAGE_PRODUCTS'), validate(categoryCreateSchema), categoryController.createCategory);
router.put('/categories/:id', authorize('MANAGE_PRODUCTS'), validate(categoryUpdateSchema), categoryController.updateCategory);
router.delete('/categories/:id', authorize('MANAGE_PRODUCTS'), categoryController.deleteCategory);

// --- Products ---
router.get('/products/search', productController.searchProducts);
router.get('/products/:id', productController.getProductById);
// Create product
router.post('/products', authorize('MANAGE_PRODUCTS'), validate(productCreateSchema), productController.createProduct);

// Update product
router.put('/products/:id', authorize('MANAGE_PRODUCTS'), validate(productUpdateSchema), productController.updateProduct);
router.delete('/products/:id', authorize('MANAGE_PRODUCTS'), productController.deleteProduct);

// Product Images
router.post(
  '/products/:id/images', 
  authorize('MANAGE_PRODUCTS'), 
  upload.single('image'), 
  productController.uploadProductImage
);
router.delete(
  '/products/:id/images/:imageId',
  authorize('MANAGE_PRODUCTS'),
  productController.deleteProductImage
);

// --- Deals ---
router.get('/deals', dealController.getDeals);
router.get('/deals/:id', dealController.getDealById);
router.post('/deals', authorize('MANAGE_PRODUCTS'), dealController.createDeal);
router.put('/deals/:id', authorize('MANAGE_PRODUCTS'), dealController.updateDeal);
router.delete('/deals/:id', authorize('MANAGE_PRODUCTS'), dealController.deleteDeal);

// --- Variants ---
router.post('/products/:productId/variants', authorize('MANAGE_PRODUCTS'), variantController.createVariant);
router.put('/variants/:variantId', authorize('MANAGE_PRODUCTS'), variantController.updateVariant);
router.delete('/variants/:variantId', authorize('MANAGE_PRODUCTS'), variantController.deleteVariant);

// --- Modifiers ---
router.get('/modifiers', modifierController.getModifiers);
router.post('/modifiers', authorize('MANAGE_PRODUCTS'), modifierController.createModifier);
router.put('/modifiers/:modifierId', authorize('MANAGE_PRODUCTS'), modifierController.updateModifier);

router.get('/modifier-groups', modifierController.getModifierGroups);
router.post('/modifier-groups', authorize('MANAGE_PRODUCTS'), modifierController.createGroup);
router.put('/modifier-groups/:groupId', authorize('MANAGE_PRODUCTS'), modifierController.updateModifierGroup);
router.delete('/modifier-groups/:groupId', authorize('MANAGE_PRODUCTS'), modifierController.deleteModifierGroup);

router.post('/modifier-groups/:groupId/options/:modifierId', authorize('MANAGE_PRODUCTS'), modifierController.addModifierToGroup);
router.delete('/modifier-groups/:groupId/options/:modifierId', authorize('MANAGE_PRODUCTS'), modifierController.removeModifierFromGroup);

router.post('/products/:productId/modifier-groups/:groupId', authorize('MANAGE_PRODUCTS'), modifierController.linkGroupToProduct);
router.delete('/products/:productId/modifier-groups/:groupId', authorize('MANAGE_PRODUCTS'), modifierController.unlinkGroupFromProduct);

export default router;
