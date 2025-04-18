import { Router } from 'express';
import cameraRouter from './camera.route';

const router = Router();

router.use('/camera', (cameraRouter));

export default router;