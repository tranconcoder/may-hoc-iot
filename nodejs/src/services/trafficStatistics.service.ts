import { OkResponse } from "@/core/success.response.js";
import {
  InternalServerErrorResponse,
  NotFoundErrorResponse,
} from "@/core/error.core.js";
import trafficStatisticsModel, {
  ITrafficStatistics,
} from "@/models/trafficStatistics.model.js";

export default new (class TrafficStatisticsService {
  async getTrafficStatistics(
    startDate: string,
    endDate: string,
    cameraId?: string
  ) {
    try {
      const query: any = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };

      if (cameraId) {
        query.camera_id = cameraId;
      }

      const statistics = await trafficStatisticsModel
        .find(query)
        .sort({ date: 1, minute_of_day: 1 });

      // Group by date and calculate totals
      const groupedStats = statistics.reduce((acc: any, stat: any) => {
        const date = stat.date.toISOString().split("T")[0];
        if (!acc[date]) {
          acc[date] = {
            date,
            totalVehicles: 0,
            vehicles: {
              car: 0,
              truck: 0,
              bus: 0,
              motorcycle: 0,
            },
          };
        }
        acc[date].totalVehicles += stat.vehicle_count;

        // Sum vehicle types
        if (stat.vehicle_types) {
          Object.keys(stat.vehicle_types).forEach((type) => {
            if (acc[date].vehicles[type] !== undefined) {
              acc[date].vehicles[type] += stat.vehicle_types[type];
            }
          });
        }

        return acc;
      }, {});

      return Object.values(groupedStats);
    } catch (error: any) {
      console.error("Error getting traffic statistics:", error);
      throw new InternalServerErrorResponse("Failed to get traffic statistics");
    }
  }

  async getStatisticsByDate(cameraId: string, date: Date) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const statistics = await trafficStatisticsModel
        .find({
          camera_id: cameraId,
          date: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        })
        .sort({ minute_of_day: 1 });

      return statistics;
    } catch (error: any) {
      console.error("Error getting statistics by date:", error);
      throw new InternalServerErrorResponse("Failed to get statistics by date");
    }
  }

  async getStatisticsByDateRange(
    cameraId: string,
    startDate: Date,
    endDate: Date
  ) {
    try {
      const statistics = await trafficStatisticsModel
        .find({
          camera_id: cameraId,
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        })
        .sort({ date: 1, minute_of_day: 1 });

      return statistics;
    } catch (error: any) {
      console.error("Error getting statistics by date range:", error);
      throw new InternalServerErrorResponse(
        "Failed to get statistics by date range"
      );
    }
  }

  async saveStatistics(data: ITrafficStatistics) {
    try {
      const statistics = await trafficStatisticsModel.create(data);
      return statistics;
    } catch (error: any) {
      console.error("Error saving traffic statistics:", error);
      throw new InternalServerErrorResponse(
        "Failed to save traffic statistics"
      );
    }
  }
})();
