import { Router } from "express";
import cameraRouter from "@/routes/camera.route.js";
import violationRouter from "@/routes/violation.route.js";
import licensePlateRouter from "@/routes/licensePlate.route.js";
import trafficStatisticsRouter from "@/routes/trafficStatistics.route.js";
import statisticsApiRouter from "@/routes/statisticsApi.route.js";

const router = Router();

router.use("/camera", cameraRouter);
router.use("/violation", violationRouter);
router.use("/license-plates", licensePlateRouter);
router.use("/traffic-statistics", trafficStatisticsRouter);
router.use("/statistics", statisticsApiRouter);

export default router;
