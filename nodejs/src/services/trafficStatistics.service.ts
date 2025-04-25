import trafficStatisticsModel from "@/models/trafficStatistics.model.js";
import { CarEnum } from "@/enums/car.enum.js";

export default new (class TrafficStatisticsService {
  async saveStatistics(data: {
    camera_id: string;
    detections: Array<{
      class: string;
      confidence: number;
    }>;
    created_at: number;
  }) {
    const now = new Date(data.created_at);
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const minute_of_day = now.getHours() * 60 + now.getMinutes();

    // Count vehicles by type
    const vehicle_types = {
      car: 0,
      truck: 0,
      bus: 0,
      motorcycle: 0,
    };

    data.detections.forEach((detection) => {
      const vehicleType = detection.class.toLowerCase();
      if (vehicleType in vehicle_types) {
        vehicle_types[vehicleType as keyof typeof vehicle_types]++;
      }
    });

    // Calculate total vehicle count
    const vehicle_count = Object.values(vehicle_types).reduce(
      (sum, count) => sum + count,
      0
    );

    // Save statistics
    await trafficStatisticsModel.findOneAndUpdate(
      {
        camera_id: data.camera_id,
        date,
        minute_of_day,
      },
      {
        camera_id: data.camera_id,
        date,
        minute_of_day,
        vehicle_count,
        vehicle_types,
      },
      {
        upsert: true,
        new: true,
      }
    );
  }

  async getStatisticsByDate(camera_id: string, date: Date) {
    return await trafficStatisticsModel.find({
      camera_id,
      date: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    }).sort({ minute_of_day: 1 });
  }

  async getStatisticsByDateRange(
    camera_id: string,
    start_date: Date,
    end_date: Date
  ) {
    return await trafficStatisticsModel.find({
      camera_id,
      date: {
        $gte: new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate()),
        $lte: new Date(end_date.getFullYear(), end_date.getMonth(), end_date.getDate()),
      },
    }).sort({ date: 1, minute_of_day: 1 });
  }
})(); 