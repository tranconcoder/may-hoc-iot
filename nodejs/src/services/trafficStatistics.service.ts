import { OkResponse } from "@/core/success.response.js";
import {
  InternalServerErrorResponse,
  NotFoundErrorResponse,
} from "@/core/error.core.js";
import trafficStatisticsModel, {
  ITrafficStatistics,
} from "@/models/trafficStatistics.model.js";

export default new (class TrafficStatisticsService {
  // Phương thức mới để lấy thống kê chi tiết cho trang chủ
  async getDashboardStatistics(date: Date) {
    try {
      // Đặt giờ về đầu ngày để lấy dữ liệu cả ngày
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Lấy thống kê theo từng giờ trong ngày
      const hourlyStats = await this.getHourlyStatistics(startOfDay, endOfDay);

      // Lấy thống kê 30 phút gần nhất
      const last30MinStats = await this.getLast30MinutesStatistics();

      // Tính tổng số xe trong ngày
      const totalVehicles = hourlyStats.reduce(
        (sum, stat) => sum + stat.totalVehicles,
        0
      );

      // Tính tổng số xe theo loại
      const vehiclesByType = hourlyStats.reduce(
        (acc, stat) => {
          acc.car += stat.vehicles.car || 0;
          acc.truck += stat.vehicles.truck || 0;
          acc.bus += stat.vehicles.bus || 0;
          acc.motorcycle += stat.vehicles.motorcycle || 0;
          return acc;
        },
        { car: 0, truck: 0, bus: 0, motorcycle: 0 }
      );

      // Lấy thống kê theo phút trong giờ hiện tại
      const currentHour = new Date().getHours();
      const minutelyStats = await this.getMinutelyStatistics(date, currentHour);

      // So sánh với ngày hôm trước để tính % thay đổi
      const previousDay = new Date(date);
      previousDay.setDate(previousDay.getDate() - 1);
      const prevStartOfDay = new Date(previousDay);
      prevStartOfDay.setHours(0, 0, 0, 0);
      const prevEndOfDay = new Date(previousDay);
      prevEndOfDay.setHours(23, 59, 59, 999);

      const previousDayStats = await trafficStatisticsModel
        .find({
          date: {
            $gte: prevStartOfDay,
            $lte: prevEndOfDay,
          },
        })
        .exec();

      const previousDayTotal = previousDayStats.reduce(
        (sum, stat) => sum + stat.vehicle_count,
        0
      );

      let percentChange = 0;
      if (previousDayTotal > 0) {
        percentChange = Math.round(
          ((totalVehicles - previousDayTotal) / previousDayTotal) * 100
        );
      }

      return {
        date: date.toISOString().split("T")[0],
        totalVehicles,
        vehiclesByType,
        hourlyStats,
        minutelyStats,
        last30MinStats,
        comparison: {
          previousDayTotal,
          percentChange,
        },
      };
    } catch (error: any) {
      console.error("Error getting dashboard statistics:", error);
      throw new InternalServerErrorResponse(
        "Failed to get dashboard statistics"
      );
    }
  }

  // Lấy thống kê theo từng giờ trong ngày
  private async getHourlyStatistics(startOfDay: Date, endOfDay: Date) {
    try {
      // Lấy tất cả dữ liệu thống kê của ngày
      const statistics = await trafficStatisticsModel
        .find({
          date: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        })
        .sort({ minute_of_day: 1 })
        .exec();

      // Nhóm dữ liệu theo giờ
      const hourlyData: any[] = Array(24)
        .fill(null)
        .map((_, hour) => ({
          hour,
          totalVehicles: 0,
          vehicles: {
            car: 0,
            truck: 0,
            bus: 0,
            motorcycle: 0,
          },
        }));

      statistics.forEach((stat) => {
        // Lấy giờ từ minute_of_day (minute_of_day = hour * 60 + minute)
        const hour = Math.floor(stat.minute_of_day / 60);

        if (hour >= 0 && hour < 24) {
          hourlyData[hour].totalVehicles += stat.vehicle_count;

          // Cộng dồn số lượng xe theo loại
          if (stat.vehicle_types) {
            Object.entries(stat.vehicle_types).forEach(([type, count]) => {
              if (hourlyData[hour].vehicles[type] !== undefined) {
                hourlyData[hour].vehicles[type] += count as number;
              }
            });
          }
        }
      });

      return hourlyData;
    } catch (error: any) {
      console.error("Error getting hourly statistics:", error);
      throw new InternalServerErrorResponse("Failed to get hourly statistics");
    }
  }

  // Lấy thống kê cho từng phút trong giờ chỉ định
  private async getMinutelyStatistics(date: Date, hour: number) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const minMinuteOfDay = hour * 60; // Phút đầu tiên của giờ
      const maxMinuteOfDay = (hour + 1) * 60 - 1; // Phút cuối cùng của giờ

      const statistics = await trafficStatisticsModel
        .find({
          date: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
          minute_of_day: {
            $gte: minMinuteOfDay,
            $lte: maxMinuteOfDay,
          },
        })
        .sort({ minute_of_day: 1 })
        .exec();

      // Tạo mảng phút trong giờ
      const minutelyData: any[] = Array(60)
        .fill(null)
        .map((_, minute) => ({
          minute,
          totalVehicles: 0,
          vehicles: {
            car: 0,
            truck: 0,
            bus: 0,
            motorcycle: 0,
          },
        }));

      statistics.forEach((stat) => {
        const minute = stat.minute_of_day % 60;
        if (minute >= 0 && minute < 60) {
          minutelyData[minute].totalVehicles += stat.vehicle_count;

          // Cộng dồn số lượng xe theo loại
          if (stat.vehicle_types) {
            Object.entries(stat.vehicle_types).forEach(([type, count]) => {
              if (minutelyData[minute].vehicles[type] !== undefined) {
                minutelyData[minute].vehicles[type] += count as number;
              }
            });
          }
        }
      });

      return {
        hour,
        data: minutelyData,
      };
    } catch (error: any) {
      console.error("Error getting minutely statistics:", error);
      throw new InternalServerErrorResponse(
        "Failed to get minutely statistics"
      );
    }
  }

  // Lấy thống kê 30 phút gần nhất
  private async getLast30MinutesStatistics() {
    try {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      // Tính minute_of_day hiện tại và 30 phút trước
      const currentDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();
      let minMinuteOfDay = currentMinuteOfDay - 30;

      // Nếu minMinuteOfDay âm, tức là đang lấy dữ liệu từ ngày hôm trước
      let startDate = currentDate;
      if (minMinuteOfDay < 0) {
        minMinuteOfDay += 24 * 60; // Điều chỉnh lại phút trong ngày
        startDate = new Date(currentDate);
        startDate.setDate(startDate.getDate() - 1);
      }

      const statistics = await trafficStatisticsModel
        .find({
          $or: [
            {
              date: startDate,
              minute_of_day: { $gte: minMinuteOfDay },
            },
            {
              date: currentDate,
              minute_of_day: { $lte: currentMinuteOfDay },
            },
          ],
        })
        .sort({ date: 1, minute_of_day: 1 })
        .exec();

      // Tạo mảng chứa dữ liệu 30 phút
      const last30MinData: any[] = Array(30)
        .fill(null)
        .map((_, index) => {
          const minuteAgo = 29 - index; // 0 = 29 phút trước, 29 = hiện tại
          return {
            minuteAgo,
            timestamp: new Date(
              now.getTime() - minuteAgo * 60 * 1000
            ).toISOString(),
            totalVehicles: 0,
            vehicles: {
              car: 0,
              truck: 0,
              bus: 0,
              motorcycle: 0,
            },
          };
        });

      // Phân bổ dữ liệu vào các khoảng thời gian tương ứng
      statistics.forEach((stat) => {
        const statTime = new Date(stat.date);
        statTime.setHours(Math.floor(stat.minute_of_day / 60));
        statTime.setMinutes(stat.minute_of_day % 60);

        // Tính khoảng thời gian (phút) giữa thời điểm hiện tại và thời điểm của bản ghi
        const minutesDiff = Math.floor(
          (now.getTime() - statTime.getTime()) / (60 * 1000)
        );

        if (minutesDiff >= 0 && minutesDiff < 30) {
          const index = 29 - minutesDiff;
          last30MinData[index].totalVehicles += stat.vehicle_count;

          // Cộng dồn số lượng xe theo loại
          if (stat.vehicle_types) {
            Object.entries(stat.vehicle_types).forEach(([type, count]) => {
              if (last30MinData[index].vehicles[type] !== undefined) {
                last30MinData[index].vehicles[type] += count as number;
              }
            });
          }
        }
      });

      return last30MinData;
    } catch (error: any) {
      console.error("Error getting last 30 minutes statistics:", error);
      throw new InternalServerErrorResponse(
        "Failed to get last 30 minutes statistics"
      );
    }
  }

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
