import { Router } from "express";
import trafficStatisticsController from "@/controllers/trafficStatistics.controller.js";

const router = Router();

// API routes
// router.get("/", trafficStatisticsController.getTrafficStatistics);
router.get("/date", trafficStatisticsController.getStatisticsByDate);
router.get("/range", trafficStatisticsController.getStatisticsByDateRange);

// API mới cho thống kê trang chủ
router.get("/dashboard", trafficStatisticsController.getDashboardStatistics);

// View routes
router.get("/", trafficStatisticsController.renderStatisticsPage);

export default router;
