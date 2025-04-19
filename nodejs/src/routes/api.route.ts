import { Router } from 'express';
import cameraRouter from '@/routes/camera.route.js';

const router = Router();

router.use('/camera', (cameraRouter));

export default router;