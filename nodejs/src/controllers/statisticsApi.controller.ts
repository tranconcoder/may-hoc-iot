import { Request, Response } from "express";
import cameraService from "@/services/camera.service.js";
import cameraImageModel from "@/models/cameraImage.model.js";
import carDetectionModel from "@/models/carDetection.model.js";
import trafficStatisticsModel from "@/models/trafficStatistics.model.js";
import { Types } from "mongoose";
import trafficStatisticsService from "@/services/trafficStatistics.service.js";
import { privateEncrypt } from "crypto";

export default new (class StatisticsApiController {
  /* -------------------------------------------------------------------------- */
  /*                            Get Active Cameras                              */
  /* -------------------------------------------------------------------------- */
  async getActiveCameras(req: Request, res: Response) {
    try {
      console.log("API getActiveCameras called");

      // Timestamp 15 seconds ago
      const fifteenSecondsAgo = new Date(Date.now() - 15000);

      console.log("Timestamp 15s ago:", fifteenSecondsAgo);

      // Get all cameras
      const allCameras = await cameraService.getAllCameras();
      console.log("Total cameras found:", allCameras.length);

      // Get recent camera images
      const recentCameraImages = await cameraImageModel
        .find({
          created_at: { $gte: fifteenSecondsAgo },
        })
        .distinct("cameraId");

      console.log("Recent active camera count:", recentCameraImages.length);
      console.log("Active camera IDs:", recentCameraImages);

      // Mark cameras as active if they have recent images
      const camerasWithStatus = allCameras.map((camera) => {
        const isActive = recentCameraImages.some(
          (id) => id.toString() === camera._id.toString()
        );
        console.log(
          `Camera ${camera.camera_name} (${camera._id}): ${
            isActive ? "active" : "inactive"
          }`
        );
        return {
          ...camera,
          isActive,
        };
      });

      console.log("API response ready");
      res.json({
        success: true,
        message: "Active cameras retrieved successfully",
        data: {
          total: allCameras.length,
          active: recentCameraImages.length,
          cameras: camerasWithStatus,
        },
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
      // Đảm bảo thời gian chính xác cho múi giờ Việt Nam (+7)
      const UTC_OFFSET = 7 * 60 * 60 * 1000; // 7 giờ tính bằng milliseconds

      // Lấy ngày hôm nay theo giờ Việt Nam
      const nowLocal = new Date(Date.now() + UTC_OFFSET);
      const todayLocal = new Date(nowLocal);
      todayLocal.setHours(0, 0, 0, 0);

      const tomorrowLocal = new Date(todayLocal);
      tomorrowLocal.setDate(tomorrowLocal.getDate() + 1);

      // Chuyển về UTC để truy vấn MongoDB
      const todayUTC = new Date(todayLocal.getTime() - UTC_OFFSET);
      const tomorrowUTC = new Date(tomorrowLocal.getTime() - UTC_OFFSET);

      console.log(
        `Getting today's vehicle count for local date: ${todayLocal.toLocaleDateString()}`
      );
      console.log(
        `UTC date range for query: ${todayUTC.toISOString()} - ${tomorrowUTC.toISOString()}`
      );

      // QUAN TRỌNG: Sử dụng phạm vi ngày thay vì một ngày cụ thể
      const todayStats = await trafficStatisticsModel.aggregate([
        {
          $match: {
            date: {
              $gte: todayUTC,
              $lt: tomorrowUTC,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalCount: { $sum: "$vehicle_count" },
            carCount: { $sum: "$vehicle_types.car" },
            truckCount: { $sum: "$vehicle_types.truck" },
            busCount: { $sum: "$vehicle_types.bus" },
            motorcycleCount: { $sum: "$vehicle_types.motorcycle" },
          },
        },
      ]);

      // Chuẩn bị kết quả trả về
      const result =
        todayStats.length > 0
          ? {
              total: todayStats[0].totalCount,
              byType: {
                car: todayStats[0].carCount,
                truck: todayStats[0].truckCount,
                bus: todayStats[0].busCount,
                motorcycle: todayStats[0].motorcycleCount,
                bicycle: 0, // Mặc định là 0 vì model không có trường này
              },
            }
          : {
              total: 0,
              byType: {
                car: 0,
                truck: 0,
                bus: 0,
                motorcycle: 0,
                bicycle: 0,
              },
            };

      console.log("Today vehicle stats:", result);

      res.json({
        success: true,
        message: "Today's vehicle count retrieved successfully",
        data: result,
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
      // Đảm bảo thời gian chính xác cho múi giờ Việt Nam (+7)
      const UTC_OFFSET = 7 * 60 * 60 * 1000; // 7 giờ tính bằng milliseconds
      const { date } = req.query;

      // Chuyển đổi ngày từ string sang Date object nếu có
      const targetDate = date ? new Date(date as string) : new Date();

      // Lấy ngày bắt đầu và kết thúc theo LOCAL để hiển thị
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Chuyển đổi về UTC để truy vấn
      const startOfDayUTC = new Date(startOfDay.getTime() - UTC_OFFSET);
      const endOfDayUTC = new Date(endOfDay.getTime() - UTC_OFFSET);

      console.log(
        `Getting hourly stats for local date: ${targetDate.toLocaleDateString()}`
      );
      console.log(
        `UTC date range for query: ${startOfDayUTC.toISOString()} - ${endOfDayUTC.toISOString()}`
      );

      // QUAN TRỌNG: Truy vấn theo PHẠM VI NGÀY UTC thay vì một ngày cụ thể
      const hourlyData = await trafficStatisticsModel.aggregate([
        {
          $match: {
            date: {
              $gte: startOfDayUTC,
              $lte: endOfDayUTC,
            },
          },
        },
        {
          $group: {
            _id: { $floor: { $divide: ["$minute_of_day", 60] } }, // Chuyển minute_of_day thành giờ
            vehicleCount: { $sum: "$vehicle_count" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      console.log(`Found ${hourlyData.length} hourly records:`, hourlyData);

      // Format for Chart.js với múi giờ +7
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const chartData = hours.map((hour) => {
        // Tìm dữ liệu cho giờ hiện tại
        // Lưu ý: hour là giờ địa phương (UTC+7), trong khi _id trong hourlyData là giờ UTC
        // Cần chuyển đổi hour sang giờ UTC để tìm dữ liệu chính xác
        const utcHour = (hour - 7 + 24) % 24; // Chuyển giờ địa phương thành giờ UTC

        const hourData = hourlyData.find((data) => data._id === utcHour);
        return hourData ? hourData.vehicleCount : 0;
      });

      res.json({
        success: true,
        message: "Hourly statistics retrieved successfully",
        data: {
          labels: hours.map((h) => `${h.toString().padStart(2, "0")}:00`),
          datasets: [
            {
              label: `Phương tiện theo giờ (${targetDate.toLocaleDateString()})`,
              data: chartData,
            },
          ],
        },
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
      // Đảm bảo thời gian chính xác cho múi giờ Việt Nam (+7)
      const UTC_OFFSET = 7 * 60 * 60 * 1000; // 7 giờ tính bằng milliseconds
      const { period } = req.query;

      // Lấy thời gian hiện tại theo múi giờ Việt Nam
      const now = new Date(Date.now() + UTC_OFFSET);

      // Chuyển đổi về UTC để truy vấn MongoDB
      const nowUTC = new Date(now.getTime() - UTC_OFFSET);

      let startTime: Date;
      let endTime = new Date(now);
      let startTimeUTC: Date;
      let endTimeUTC = new Date(nowUTC);
      let periodLabel: string;

      // Xác định khoảng thời gian dựa trên period được truyền vào
      if (period === "last-hour") {
        // Dữ liệu của 1 giờ gần đây - giờ địa phương
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        // Chuyển sang UTC
        startTimeUTC = new Date(startTime.getTime() - UTC_OFFSET);
        periodLabel = "1 giờ gần đây";
      } else if (period === "last-30-minutes") {
        // Dữ liệu của 30 phút gần đây - giờ địa phương
        startTime = new Date(now.getTime() - 30 * 60 * 1000);
        // Chuyển sang UTC
        startTimeUTC = new Date(startTime.getTime() - UTC_OFFSET);
        periodLabel = "30 phút gần đây";
      } else {
        // Mặc định là dữ liệu của hôm nay - giờ địa phương
        startTime = new Date(now);
        startTime.setHours(0, 0, 0, 0);
        // Chuyển sang UTC
        startTimeUTC = new Date(startTime.getTime() - UTC_OFFSET);
        periodLabel = "Hôm nay";
      }

      // Tính toán phút trong ngày (theo UTC)
      const startMinuteOfDayUTC =
        startTimeUTC.getHours() * 60 + startTimeUTC.getMinutes();
      const endMinuteOfDayUTC =
        endTimeUTC.getHours() * 60 + endTimeUTC.getMinutes();

      console.log(
        `Getting minute stats from ${startTime.toLocaleString()} to ${endTime.toLocaleString()} (${periodLabel}) - Local time`
      );
      console.log(
        `UTC time: ${startTimeUTC.toISOString()} to ${endTimeUTC.toISOString()}`
      );
      console.log(
        `UTC minute range: ${startMinuteOfDayUTC} - ${endMinuteOfDayUTC}`
      );

      // Lấy ngày UTC để truy vấn - phải dùng phạm vi ngày
      const startDateUTC = new Date(startTimeUTC);
      startDateUTC.setHours(0, 0, 0, 0);

      const endDateUTC = new Date(endTimeUTC);
      endDateUTC.setHours(0, 0, 0, 0);

      // Nếu ngày kết thúc sau ngày bắt đầu (khác ngày)
      const nextDayUTC = new Date(startDateUTC);
      nextDayUTC.setDate(nextDayUTC.getDate() + 1);

      // Chuẩn bị điều kiện truy vấn dựa trên khoảng thời gian
      let matchCondition;

      if (startDateUTC.getTime() === endDateUTC.getTime()) {
        // Cùng một ngày UTC
        matchCondition = {
          date: {
            $gte: startDateUTC,
            $lt: new Date(startDateUTC.getTime() + 24 * 60 * 60 * 1000), // Đảm bảo lấy đủ dữ liệu của cả ngày
          },
          minute_of_day: {
            $gte: startMinuteOfDayUTC,
            $lte: endMinuteOfDayUTC,
          },
        };
      } else {
        // Khác ngày UTC - cần dùng $or
        matchCondition = {
          $or: [
            {
              // Ngày đầu tiên, từ startMinuteOfDayUTC đến cuối ngày
              date: {
                $gte: startDateUTC,
                $lt: nextDayUTC,
              },
              minute_of_day: { $gte: startMinuteOfDayUTC },
            },
            {
              // Ngày thứ hai, từ đầu ngày đến endMinuteOfDayUTC
              date: {
                $gte: endDateUTC,
                $lt: new Date(endDateUTC.getTime() + 24 * 60 * 60 * 1000),
              },
              minute_of_day: { $lte: endMinuteOfDayUTC },
            },
          ],
        };
      }

      console.log("Match condition:", JSON.stringify(matchCondition, null, 2));

      // Truy vấn dữ liệu từ trafficStatisticsModel
      const minuteData = await trafficStatisticsModel.aggregate([
        {
          $match: matchCondition,
        },
        {
          $project: {
            minute_of_day: 1,
            vehicle_count: 1,
            date: 1,
            vehicle_types: 1,
          },
        },
        {
          $sort: { date: 1, minute_of_day: 1 },
        },
      ]);

      console.log(`Found ${minuteData.length} minute records`);

      // Log một số dữ liệu mẫu để kiểm tra
      if (minuteData.length > 0) {
        console.log("Sample data:", minuteData.slice(0, 3));
      }

      // Kiểm tra xem dữ liệu có đúng định dạng không
      let dataHasError = false;
      for (const item of minuteData) {
        if (
          typeof item.minute_of_day !== "number" ||
          typeof item.vehicle_count !== "number"
        ) {
          console.error("Invalid data format:", item);
          dataHasError = true;
          break;
        }
      }

      if (dataHasError) {
        throw new Error("Invalid data format in database records");
      }

      // Tạo mảng thời gian cho từng phút trong khoảng thời gian - theo múi giờ LOCAL
      const minuteLabels: string[] = [];
      const minuteValues: number[] = [];
      const minuteData_Map = new Map();

      // Tạo một Map để tra cứu dữ liệu nhanh hơn
      minuteData.forEach((item) => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        const key = `${itemDate.toISOString().split("T")[0]}-${
          item.minute_of_day
        }`;
        minuteData_Map.set(key, item.vehicle_count);
      });

      // Duyệt từng phút trong khoảng thời gian địa phương
      let currentTime = new Date(startTime);
      while (currentTime <= endTime) {
        const hour = currentTime.getHours();
        const minute = currentTime.getMinutes();
        const timeString = `${hour.toString().padStart(2, "0")}:${minute
          .toString()
          .padStart(2, "0")}`;
        minuteLabels.push(timeString);

        // Chuyển đổi thời gian hiện tại sang UTC để tìm dữ liệu
        const currentTimeUTC = new Date(currentTime.getTime() - UTC_OFFSET);
        const utcHour = currentTimeUTC.getHours();
        const utcMinute = currentTimeUTC.getMinutes();
        const minuteOfDayUTC = utcHour * 60 + utcMinute;
        const currentDateUTC = new Date(currentTimeUTC);
        currentDateUTC.setHours(0, 0, 0, 0);

        // Sử dụng Map để tìm kiếm nhanh hơn
        const key = `${
          currentDateUTC.toISOString().split("T")[0]
        }-${minuteOfDayUTC}`;
        const vehicleCount = minuteData_Map.get(key) || 0;
        minuteValues.push(vehicleCount);

        // Tăng lên 1 phút
        currentTime.setMinutes(currentTime.getMinutes() + 1);
      }

      // Log một số thông tin để gỡ lỗi
      console.log(`Generated ${minuteLabels.length} time labels`);
      console.log(`Generated ${minuteValues.length} data points`);
      if (minuteValues.some((v) => v > 0)) {
        console.log("Found non-zero values in the data");
      } else {
        console.log("WARNING: All values are zero in the result");
      }

      res.json({
        success: true,
        message: "Minute statistics retrieved successfully",
        data: {
          labels: minuteLabels,
          datasets: [
            {
              label: `Số lượng phương tiện theo phút (${periodLabel})`,
              data: minuteValues,
            },
          ],
        },
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
      // Constants for time conversion
      const UTC_OFFSET = 7 * 60 * 60 * 1000; // UTC+7 for Vietnam in milliseconds

      // Get current time in UTC
      const now = new Date();
      console.log(`Current UTC time: ${now.toISOString()}`);

      // Get current local time (UTC+7) for display purposes
      const localNow = new Date(now.getTime() + UTC_OFFSET);
      console.log(`Current local time: ${localNow.toLocaleString()}`);

      // Generate 30 minute intervals for the chart (in local time)
      const minuteLabels = [];
      const minuteValues = Array(30).fill(0); // Initialize with zeros

      // Pre-calculate minute labels in local time
      for (let i = 0; i < 30; i++) {
        const localTime = new Date(localNow.getTime() - (29 - i) * 60 * 1000);
        const hour = localTime.getHours().toString().padStart(2, "0");
        const minute = localTime.getMinutes().toString().padStart(2, "0");
        minuteLabels.push(`${hour}:${minute}`);
      }

      // Get midnight of today in UTC
      const todayUTC = new Date(now);
      todayUTC.setHours(0, 0, 0, 0);

      // Get midnight of yesterday in UTC
      const yesterdayUTC = new Date(todayUTC);
      yesterdayUTC.setDate(todayUTC.getDate() - 1);

      console.log(`Today UTC midnight: ${todayUTC.toISOString()}`);
      console.log(`Yesterday UTC midnight: ${yesterdayUTC.toISOString()}`);

      // Calculate minute ranges for today and yesterday
      const currentMinuteOfDayUTC = now.getHours() * 60 + now.getMinutes();
      console.log(`Current minute of day in UTC: ${currentMinuteOfDayUTC}`);

      // Define a simpler approach - get all data for the current hour and previous hour
      const currentHourUTC = now.getHours();
      const previousHourUTC = (currentHourUTC - 1 + 24) % 24; // Handle wrapping around midnight

      // Calculate minute ranges for filtering
      const currentHourStartMinute = currentHourUTC * 60;
      const currentHourEndMinute = currentHourStartMinute + 59;
      const previousHourStartMinute = previousHourUTC * 60;
      const previousHourEndMinute = previousHourStartMinute + 59;

      console.log(
        `Querying for minutes in ranges: ${previousHourStartMinute}-${previousHourEndMinute} and ${currentHourStartMinute}-${currentHourEndMinute}`
      );

      // Determine which day(s) to query based on the hour
      let dayQuery = {
        date: {
          $gte: todayUTC,
          $lt: new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000),
        },
      };
      if (currentHourUTC < 1) {
        // If we're in the first hour of the day, we might need yesterday's data too
        dayQuery = {
          $or: [
            { date: { $gte: yesterdayUTC, $lt: todayUTC } },
            {
              date: {
                $gte: todayUTC,
                $lt: new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000),
              },
            },
          ],
        };
      }

      // Query for all relevant data
      const query = {
        ...dayQuery,
        $or: [
          {
            minute_of_day: {
              $gte: previousHourStartMinute,
              $lte: previousHourEndMinute,
            },
          },
          {
            minute_of_day: {
              $gte: currentHourStartMinute,
              $lte: currentHourEndMinute,
            },
          },
        ],
      };

      console.log("Database query:", JSON.stringify(query, null, 2));

      const trafficData = await trafficStatisticsModel.find(query).lean();
      console.log(`Found ${trafficData.length} relevant records`);

      // Log some sample data if available
      if (trafficData.length > 0) {
        console.log("Sample records:", trafficData.slice(0, 2));
      }

      // Store minute data for fast lookup
      const minuteDataMap = new Map();
      trafficData.forEach((record) => {
        minuteDataMap.set(record.minute_of_day, record.vehicle_count);
      });

      // Fill in the actual data by finding the corresponding UTC minute
      for (let i = 0; i < 30; i++) {
        // Calculate the exact UTC timestamp for this minute
        const minuteTimeUTC = new Date(now.getTime() - (29 - i) * 60 * 1000);
        const minuteOfDayUTC =
          minuteTimeUTC.getHours() * 60 + minuteTimeUTC.getMinutes();

        // Look up the data for this minute
        if (minuteDataMap.has(minuteOfDayUTC)) {
          minuteValues[i] = minuteDataMap.get(minuteOfDayUTC);
        }
      }

      // Check if we found any data
      const hasData = minuteValues.some((count) => count > 0);
      console.log(`Data found for chart: ${hasData ? "YES" : "NO"}`);

      // Return the data
      res.json({
        success: true,
        message: "Last 30 minutes statistics retrieved successfully",
        data: {
          labels: minuteLabels,
          datasets: [
            {
              label: "30 phút gần đây",
              data: minuteValues,
            },
          ],
        },
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
            created_at: { $gte: fiveMinutesAgo },
          },
        },
        {
          $group: {
            _id: "$camera_id",
            totalVehicles: {
              $sum: {
                $add: ["$vehicle_count.total_up", "$vehicle_count.total_down"],
              },
            },
            records: { $sum: 1 },
            latestRecord: { $max: "$created_at" },
          },
        },
        {
          $lookup: {
            from: "cameras",
            localField: "_id",
            foreignField: "_id",
            as: "camera",
          },
        },
        {
          $unwind: "$camera",
        },
        {
          $project: {
            _id: 1,
            camera_name: "$camera.camera_name",
            camera_location: "$camera.camera_location",
            totalVehicles: 1,
            records: 1,
            latestRecord: 1,
            avgVehiclesPerRecord: { $divide: ["$totalVehicles", "$records"] },
          },
        },
        {
          $sort: { avgVehiclesPerRecord: -1 },
        },
      ]);

      // Identify congestion alerts (any camera with avg > 5 vehicles per record)
      const alerts = recentTraffic
        .filter((data) => data.avgVehiclesPerRecord > 5)
        .map((data) => ({
          camera_id: data._id,
          camera_name: data.camera_name,
          camera_location: data.camera_location,
          level: data.avgVehiclesPerRecord > 10 ? "high" : "medium",
          avgVehicles: Math.round(data.avgVehiclesPerRecord * 10) / 10,
          latestUpdate: data.latestRecord,
        }));

      res.json({
        success: true,
        message: "Traffic alerts retrieved successfully",
        data: alerts,
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
      const recentCameraImages = await cameraImageModel
        .find({
          created_at: { $gte: fifteenSecondsAgo },
        })
        .distinct("cameraId");

      // Parse location strings to get coordinates
      // Assuming camera_location format is "Location Name (lat,lng)"
      const cameraLocations = cameras.map((camera) => {
        // Extract coordinates from location string if available
        let coordinates = null;
        const locationMatch = camera.camera_location.match(
          /\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/
        );

        if (locationMatch && locationMatch.length === 3) {
          coordinates = {
            lat: parseFloat(locationMatch[1]),
            lng: parseFloat(locationMatch[2]),
          };
        }

        return {
          id: camera._id,
          name: camera.camera_name,
          location: camera.camera_location.replace(/\s*\(.*\)$/, ""), // Clean location name
          coordinates,
          isActive: recentCameraImages.some(
            (id) => id.toString() === camera._id.toString()
          ),
        };
      });

      res.json({
        success: true,
        message: "Camera locations retrieved successfully",
        data: cameraLocations,
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
