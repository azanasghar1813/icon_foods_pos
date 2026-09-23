import { Router } from 'express';
import { checkHealth, claimDeviceId } from '../controllers/healthController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.get('/', checkHealth);
router.post('/device-id', authenticate, claimDeviceId);

export default router;
