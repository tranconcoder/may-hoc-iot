import { Request, Response } from "express";
import { OkResponse } from "@/core/success.response.js";
import { InternalServerErrorResponse, NotFoundErrorResponse } from "@/core/error.core.js";
import trafficStatisticsService from "@/services/trafficStatistics.service.js";

export default new class TrafficStatisticsController {
  async renderStatisticsPage(req: Request, res: Response) {
    try {
      // Get default statistics (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const statistics = await trafficStatisticsService.getTrafficStatistics(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      res.render("traffic-statistics", {
        title: "Traffic Statistics",
        layout: "main",
        data: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          statistics: statistics
        }
      });
    } catch (error: any) {
      console.error("Error rendering traffic statistics:", error);
      res.render("traffic-statistics", {
        title: "Traffic Statistics",
        layout: "main",
        error: error.message || "Failed to load statistics"
      });
    }
  }

  async getTrafficStatistics(req: Request, res: Response) {
    try {
      const { startDate, endDate, cameraId } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: "Missing required parameters: startDate and endDate"
        });
        return;
      }

      // Validate date format
      if (isNaN(Date.parse(startDate as string)) || isNaN(Date.parse(endDate as string))) {
        res.status(400).json({
          success: false,
          message: "Invalid date format. Please use ISO date format"
        });
        return;
      }

      const statistics = await trafficStatisticsService.getTrafficStatistics(
        startDate as string,
        endDate as string,
        cameraId as string
      );

      res.json({
        success: true,
        message: "Traffic statistics retrieved successfully",
        data: statistics
      });
    } catch (error: any) {
      console.error("Error getting traffic statistics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get traffic statistics"
      });
    }
  }

  async getStatisticsByDate(req: Request, res: Response) {
    try {
      const { camera_id, date } = req.query;
      
      // Validate required parameters
      if (!camera_id || !date) {
        res.status(400).json({
          success: false,
          message: "Missing required parameters: camera_id and date"
        });
        return;
      }

      // Validate date format
      if (isNaN(Date.parse(date as string))) {
        res.status(400).json({
          success: false,
          message: "Invalid date format. Please use ISO date format"
        });
        return;
      }

      const statistics = await trafficStatisticsService.getStatisticsByDate(
        camera_id as string,
        new Date(date as string)
      );

      res.json({
        success: true,
        message: "Statistics retrieved successfully",
        data: statistics
      });
    } catch (error: any) {
      console.error("Error getting statistics by date:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get statistics by date"
      });
    }
  }

  async getStatisticsByDateRange(req: Request, res: Response) {
    try {
      const { camera_id, start_date, end_date } = req.query;
      
      // Validate required parameters
      if (!camera_id || !start_date || !end_date) {
        res.status(400).json({
          success: false,
          message: "Missing required parameters: camera_id, start_date, and end_date"
        });
        return;
      }

      // Validate date format
      if (isNaN(Date.parse(start_date as string)) || isNaN(Date.parse(end_date as string))) {
        res.status(400).json({
          success: false,
          message: "Invalid date format. Please use ISO date format"
        });
        return;
      }

      const statistics = await trafficStatisticsService.getStatisticsByDateRange(
        camera_id as string,
        new Date(start_date as string),
        new Date(end_date as string)
      );

      res.json({
        success: true,
        message: "Statistics retrieved successfully",
        data: statistics
      });
    } catch (error: any) {
      console.error("Error getting statistics by date range:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get statistics by date range"
      });
    }
  }
} 