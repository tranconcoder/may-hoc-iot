import { Request, Response } from "express";
import cameraService from "@/services/camera.service.js";
import cameraImageModel from "@/models/cameraImage.model.js";
import carDetectionModel from "@/models/carDetection.model.js";
import { Types } from "mongoose";
import trafficStatisticsService from "@/services/trafficStatistics.service.js";

export default new (class StatisticsApiController {
  /* -------------------------------------------------------------------------- */
  /*                            Get Active Cameras                              */
  /* -------------------------------------------------------------------------- */
  async getActiveCameras(req: Request, res: Response) {
    try {
      console.log('API getActiveCameras called');
      
      // Timestamp 15 seconds ago
      const fifteenSecondsAgo = new Date(Date.now() - 15000);
      
      console.log('Timestamp 15s ago:', fifteenSecondsAgo);

      // Get all cameras
      const allCameras = await cameraService.getAllCameras();
      console.log('Total cameras found:', allCameras.length);
      
      // Get recent camera images
      const recentCameraImages = await cameraImageModel.find({
        created_at: { $gte: fifteenSecondsAgo }
      }).distinct("cameraId");
      
      console.log('Recent active camera count:', recentCameraImages.length);
      console.log('Active camera IDs:', recentCameraImages);

      // Mark cameras as active if they have recent images
      const camerasWithStatus = allCameras.map(camera => {
        const isActive = recentCameraImages.some(id => id.toString() === camera._id.toString());
        console.log(`Camera ${camera.camera_name} (${camera._id}): ${isActive ? 'active' : 'inactive'}`);
        return {
          ...camera,
          isActive
        };
      });

      console.log('API response ready');
      res.json({
        success: true,
        message: "Active cameras retrieved successfully",
        data: {
          total: allCameras.length,
          active: recentCameraImages.length,
          cameras: camerasWithStatus
        }
      });
    } catch (error: any) {
      console.error("Error in getActiveCameras:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get active cameras",
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                            Get Today's Vehicle Count                       */
  /* -------------------------------------------------------------------------- */
  async getTodayVehicleCount(req: Request, res: Response) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get total vehicle count for today
      const todayStats = await carDetectionModel.aggregate([
        {
          $match: {
            created_at: { $gte: today }
          }
        },
        {
          $group: {
            _id: null,
            totalVehicles: { $sum: { $add: ["$vehicle_count.total_up", "$vehicle_count.total_down"] } },
            byType: {
              $push: {
                car: { $add: ["$vehicle_count.by_type_up.car", "$vehicle_count.by_type_down.car"] },
                truck: { $add: ["$vehicle_count.by_type_up.truck", "$vehicle_count.by_type_down.truck"] },
                bus: { $add: ["$vehicle_count.by_type_up.bus", "$vehicle_count.by_type_down.bus"] },
                motorcycle: { $add: ["$vehicle_count.by_type_up.motorcycle", "$vehicle_count.by_type_down.motorcycle"] },
                bicycle: { $add: ["$vehicle_count.by_type_up.bicycle", "$vehicle_count.by_type_down.bicycle"] }
              }
            }
          }
        }
      ]);
      
      // Calculate vehicle types
      const vehicleTypes = {
        car: 0,
        truck: 0,
        bus: 0,
        motorcycle: 0,
        bicycle: 0
      };
      
      if (todayStats && todayStats.length > 0) {
        todayStats[0].byType.forEach((type: any) => {
          vehicleTypes.car += type.car || 0;
          vehicleTypes.truck += type.truck || 0; 
          vehicleTypes.bus += type.bus || 0;
          vehicleTypes.motorcycle += type.motorcycle || 0;
          vehicleTypes.bicycle += type.bicycle || 0;
        });
      }
      
      res.json({
        success: true,
        message: "Today's vehicle count retrieved successfully",
        data: {
          total: todayStats.length > 0 ? todayStats[0].totalVehicles : 0,
          byType: vehicleTypes
        }
      });
    } catch (error: any) {
      console.error("Error getting today's vehicle count:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get today's vehicle count",
      });
    }
  }
  
  /* -------------------------------------------------------------------------- */
  /*                            Get Hourly Statistics                           */
  /* -------------------------------------------------------------------------- */
  async getHourlyStats(req: Request, res: Response) {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      
      // Get hourly traffic data
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const hourlyData = await carDetectionModel.aggregate([
        {
          $match: {
            created_at: { $gte: startOfDay, $lte: endOfDay }
          }
        },
        {
          $group: {
            _id: { $hour: "$created_at" },
            vehicleCount: { $sum: { $add: ["$vehicle_count.total_up", "$vehicle_count.total_down"] } }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
      
      // Format for Chart.js
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const chartData = hours.map(hour => {
        const hourData = hourlyData.find(data => data._id === hour);
        return hourData ? hourData.vehicleCount : 0;
      });
      
      res.json({
        success: true,
        message: "Hourly statistics retrieved successfully",
        data: {
          labels: hours.map(h => `${h}:00`),
          datasets: [
            {
              label: 'Số lượng phương tiện',
              data: chartData
            }
          ]
        }
      });
    } catch (error: any) {
      console.error("Error getting hourly statistics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get hourly statistics",
      });
    }
  }
  
  /* -------------------------------------------------------------------------- */
  /*                            Get Minute Statistics                           */
  /* -------------------------------------------------------------------------- */
  async getMinuteStats(req: Request, res: Response) {
    try {
      const { hour } = req.query;
      const currentHour = hour ? parseInt(hour as string) : new Date().getHours();
      const today = new Date();
      
      const startOfHour = new Date(today);
      startOfHour.setHours(currentHour, 0, 0, 0);
      
      const endOfHour = new Date(today);
      endOfHour.setHours(currentHour, 59, 59, 999);
      
      const minuteData = await carDetectionModel.aggregate([
        {
          $match: {
            created_at: { $gte: startOfHour, $lte: endOfHour }
          }
        },
        {
          $group: {
            _id: { $minute: "$created_at" },
            vehicleCount: { $sum: { $add: ["$vehicle_count.total_up", "$vehicle_count.total_down"] } }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
      
      // Format for Chart.js
      const minutes = Array.from({ length: 60 }, (_, i) => i);
      const chartData = minutes.map(minute => {
        const minuteData = minuteData.find(data => data._id === minute);
        return minuteData ? minuteData.vehicleCount : 0;
      });
      
      res.json({
        success: true,
        message: "Minute statistics retrieved successfully",
        data: {
          labels: minutes.map(m => `${m}`),
          datasets: [
            {
              label: 'Số lượng phương tiện theo phút',
              data: chartData
            }
          ]
        }
      });
    } catch (error: any) {
      console.error("Error getting minute statistics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get minute statistics",
      });
    }
  }
  
  /* -------------------------------------------------------------------------- */
  /*                        Get Last 30 Minutes Statistics                      */
  /* -------------------------------------------------------------------------- */
  async getLast30MinutesStats(req: Request, res: Response) {
    try {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      
      const trafficData = await carDetectionModel.aggregate([
        {
          $match: {
            created_at: { $gte: thirtyMinutesAgo, $lte: now }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: "$created_at" },
              month: { $month: "$created_at" },
              day: { $dayOfMonth: "$created_at" },
              hour: { $hour: "$created_at" },
              minute: { $minute: "$created_at" }
            },
            count: { $sum: { $add: ["$vehicle_count.total_up", "$vehicle_count.total_down"] } }
          }
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1, "_id.minute": 1 }
        }
      ]);
      
      // Generate minute labels for the last 30 minutes
      const minuteLabels = [];
      const minuteData = [];
      
      // Fill in data for each minute of the last 30 minutes
      for (let i = 0; i < 30; i++) {
        const time = new Date(now.getTime() - (29 - i) * 60 * 1000);
        const hour = time.getHours();
        const minute = time.getMinutes();
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        minuteLabels.push(timeString);
        
        // Find matching traffic data for this minute
        const matchingData = trafficData.find(item => 
          item._id.hour === hour && item._id.minute === minute &&
          item._id.day === time.getDate() && item._id.month === time.getMonth() + 1
        );
        
        minuteData.push(matchingData ? matchingData.count : 0);
      }
      
      res.json({
        success: true,
        message: "Last 30 minutes statistics retrieved successfully",
        data: {
          labels: minuteLabels,
          datasets: [
            {
              label: '30 phút gần đây',
              data: minuteData
            }
          ]
        }
      });
    } catch (error: any) {
      console.error("Error getting last 30 minutes statistics:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get last 30 minutes statistics",
      });
    }
  }
  
  /* -------------------------------------------------------------------------- */
  /*                              Get Traffic Alerts                            */
  /* -------------------------------------------------------------------------- */
  async getTrafficAlerts(req: Request, res: Response) {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      // Get recent traffic data grouped by camera
      const recentTraffic = await carDetectionModel.aggregate([
        {
          $match: {
            created_at: { $gte: fiveMinutesAgo }
          }
        },
        {
          $group: {
            _id: "$camera_id",
            totalVehicles: { $sum: { $add: ["$vehicle_count.total_up", "$vehicle_count.total_down"] } },
            records: { $sum: 1 },
            latestRecord: { $max: "$created_at" }
          }
        },
        {
          $lookup: {
            from: "cameras",
            localField: "_id",
            foreignField: "_id",
            as: "camera"
          }
        },
        {
          $unwind: "$camera"
        },
        {
          $project: {
            _id: 1,
            camera_name: "$camera.camera_name",
            camera_location: "$camera.camera_location",
            totalVehicles: 1,
            records: 1,
            latestRecord: 1,
            avgVehiclesPerRecord: { $divide: ["$totalVehicles", "$records"] }
          }
        },
        {
          $sort: { avgVehiclesPerRecord: -1 }
        }
      ]);
      
      // Identify congestion alerts (any camera with avg > 5 vehicles per record)
      const alerts = recentTraffic
        .filter(data => data.avgVehiclesPerRecord > 5)
        .map(data => ({
          camera_id: data._id,
          camera_name: data.camera_name,
          camera_location: data.camera_location,
          level: data.avgVehiclesPerRecord > 10 ? 'high' : 'medium',
          avgVehicles: Math.round(data.avgVehiclesPerRecord * 10) / 10,
          latestUpdate: data.latestRecord
        }));
      
      res.json({
        success: true,
        message: "Traffic alerts retrieved successfully",
        data: alerts
      });
    } catch (error: any) {
      console.error("Error getting traffic alerts:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get traffic alerts",
      });
    }
  }
  
  /* -------------------------------------------------------------------------- */
  /*                           Get Camera Locations                             */
  /* -------------------------------------------------------------------------- */
  async getCameraLocations(req: Request, res: Response) {
    try {
      const cameras = await cameraService.getAllCameras();
      
      // Get active cameras
      const fifteenSecondsAgo = new Date(Date.now() - 15000);
      const recentCameraImages = await cameraImageModel.find({
        created_at: { $gte: fifteenSecondsAgo }
      }).distinct("cameraId");
      
      // Parse location strings to get coordinates
      // Assuming camera_location format is "Location Name (lat,lng)"
      const cameraLocations = cameras.map(camera => {
        // Extract coordinates from location string if available
        let coordinates = null;
        const locationMatch = camera.camera_location.match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/);
        
        if (locationMatch && locationMatch.length === 3) {
          coordinates = {
            lat: parseFloat(locationMatch[1]),
            lng: parseFloat(locationMatch[2])
          };
        }
        
        return {
          id: camera._id,
          name: camera.camera_name,
          location: camera.camera_location.replace(/\s*\(.*\)$/, ""), // Clean location name
          coordinates,
          isActive: recentCameraImages.some(id => id.toString() === camera._id.toString())
        };
      });
      
      res.json({
        success: true,
        message: "Camera locations retrieved successfully",
        data: cameraLocations
      });
    } catch (error: any) {
      console.error("Error getting camera locations:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get camera locations",
      });
    }
  }
})();