import { Router } from "express";
import trafficStatisticsController from "@/controllers/trafficStatistics.controller.js";

const router = Router();

// API routes
router.get("/api/statistics", trafficStatisticsController.getTrafficStatistics);
router.get("/api/statistics/date", trafficStatisticsController.getStatisticsByDate);
router.get("/api/statistics/range", trafficStatisticsController.getStatisticsByDateRange);

// View routes
router.get("/", trafficStatisticsController.renderStatisticsPage);

export default router; 