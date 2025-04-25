import { RequestHandler } from "express";
import trafficStatisticsService from "@/services/trafficStatistics.service.js";

export default new (class ViewController {
  /* ----------------------------- Home Page ----------------------------- */
  homePage: RequestHandler = async (req, res, next) => {
    try {
      // Get current week statistics (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      // Get previous week statistics for comparison
      const prevEndDate = new Date(startDate);
      prevEndDate.setDate(prevEndDate.getDate() - 1);
      const prevStartDate = new Date(prevEndDate);
      prevStartDate.setDate(prevStartDate.getDate() - 7);

      const currentStats = await trafficStatisticsService.getTrafficStatistics(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      const prevStats = await trafficStatisticsService.getTrafficStatistics(
        prevStartDate.toISOString().split('T')[0],
        prevEndDate.toISOString().split('T')[0]
      );

      // Calculate total vehicles for current week
      const totalVehiclesCount = currentStats.reduce((sum: number, day: any) => {
        return sum + day.totalVehicles;
      }, 0);

      // Calculate total vehicles for previous week
      const prevTotalVehicles = prevStats.reduce((sum: number, day: any) => {
        return sum + day.totalVehicles;
      }, 0);

      // Calculate percent change
      let percentChange = 0;
      if (prevTotalVehicles > 0) {
        percentChange = Math.round(((totalVehiclesCount - prevTotalVehicles) / prevTotalVehicles) * 100);
      }

      res.render("pages/home-page", {
        layout: "traffic-dashboard",
        isHome: true,
        totalVehiclesCount,
        percentChange,
        data: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          statistics: currentStats
        }
      });
    } catch (error: any) {
      console.error("Error fetching statistics for home page:", error);
      res.render("pages/home-page", {
        layout: "traffic-dashboard",
        isHome: true,
        error: error.message || "Không thể tải dữ liệu thống kê"
      });
    }
  };



  /* ----------------------------- Capture Page ----------------------------- */
  capturePage: RequestHandler = (req, res, next) => {
    res.render("pages/capture");
  };



  /* ----------------------------- Simulation Page ----------------------------- */
  simulationPage: RequestHandler = (req, res, next) => {
    res.render("pages/simulation");
  };



  /* ----------------------------- Create Camera Page ----------------------------- */
  createCameraPage: RequestHandler = (req, res, next) => {
    res.render("pages/add-camera", {
      layout: "traffic-dashboard",
      pageTitle: "Thêm Camera Mới",
    });
  };



  /* ----------------------------- Camera Management Page ----------------------------- */
  cameraManagementPage: RequestHandler = (req, res, next) => {
    res.render("pages/camera-management", {
      layout: "traffic-dashboard",
      pageTitle: "Quản lý Camera",
      helpers: {
        add: (a: number, b: number) => a + b, // Helper để hiển thị số trang
      },
    });
  };



  /* ----------------------------- View Camera Detail Page ----------------------------- */
  viewCameraDetail: RequestHandler = (req, res, next) => {
    const { cameraId } = req.params;

    res.render("pages/camera-view", {
      layout: "traffic-dashboard",
      pageTitle: `Camera ${cameraId}`,
    });
  };



  /* ----------------------------- Camera Preview Page ----------------------------- */
  cameraPreviewPage: RequestHandler = (req, res, next) => {
    res.render("pages/camera-preview", {
      layout: "traffic-dashboard",
      pageTitle: "Xem trực tiếp từ Camera AI",
      styles: ["/css/camera-preview.css"],
    });
  };



  /* ----------------------------- Demo Page ----------------------------- */
  demoPage: RequestHandler = (req, res, next) => {
    res.render("pages/demo");
  };



  /* ----------------------------- Violation Review Page ----------------------------- */
  violationReviewPage: RequestHandler = (req, res, next) => {
    res.render("pages/violation-review", {
      layout: "traffic-dashboard",
      pageTitle: "Duyệt Vi Phạm Giao Thông",
    });
  };
})();
