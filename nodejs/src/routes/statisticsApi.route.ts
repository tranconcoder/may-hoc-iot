import { Router } from "express";
import statisticsApiController from "@/controllers/statisticsApi.controller.js";
import { catchError } from "@/middlewares/handleError.middware.js";

const router = Router();

// Camera and traffic statistics API endpoints
router.get("/active-cameras", catchError(statisticsApiController.getActiveCameras));
router.get("/today-vehicles", catchError(statisticsApiController.getTodayVehicleCount));
router.get("/hourly-stats", catchError(statisticsApiController.getHourlyStats));
router.get("/minute-stats", catchError(statisticsApiController.getMinuteStats));
router.get("/last-30-minutes", catchError(statisticsApiController.getLast30MinutesStats));
router.get("/traffic-alerts", catchError(statisticsApiController.getTrafficAlerts));
router.get("/camera-locations", catchError(statisticsApiController.getCameraLocations));

export default router;