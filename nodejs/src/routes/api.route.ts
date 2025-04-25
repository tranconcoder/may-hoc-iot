import { Router } from 'express';
import cameraRouter from '@/routes/camera.route.js';
import violationRouter from '@/routes/violation.route.js';

const router = Router();

router.use("/camera", cameraRouter);
router.use("/violation", violationRouter);

export default router;