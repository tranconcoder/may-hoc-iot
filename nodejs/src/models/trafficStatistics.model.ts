import mongoose, { Schema, Document } from "mongoose";

export const TRAFFIC_STATISTICS_MODEL_NAME = "TrafficStatistics";
export const TRAFFIC_STATISTICS_COLLECTION_NAME = "traffic_statistics";

export interface ITrafficStatistics extends Document {
  camera_id: string;
  date: Date;  // Date only (YYYY-MM-DD)
  minute_of_day: number;  // Minute of the day (0-1439)
  vehicle_count: number;
  vehicle_types: {
    car: number;
    truck: number;
    bus: number;
    motorcycle: number;
  };
  created_at: Date;
  updated_at: Date;
}

const trafficStatisticsSchema = new Schema<ITrafficStatistics>(
  {
    camera_id: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    minute_of_day: {
      type: Number,
      required: true,
      min: 0,
      max: 1439,  // 24 hours * 60 minutes - 1
      index: true,
    },
    vehicle_count: {
      type: Number,
      required: true,
      default: 0,
    },
    vehicle_types: {
      car: {
        type: Number,
        default: 0,
      },
      truck: {
        type: Number,
        default: 0,
      },
      bus: {
        type: Number,
        default: 0,
      },
      motorcycle: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    collection: TRAFFIC_STATISTICS_COLLECTION_NAME,
  }
);

// Create compound indexes for efficient querying
trafficStatisticsSchema.index({ camera_id: 1, date: 1 });
trafficStatisticsSchema.index({ camera_id: 1, date: 1, minute_of_day: 1 });

export default mongoose.model<ITrafficStatistics>(
  TRAFFIC_STATISTICS_MODEL_NAME,
  trafficStatisticsSchema
); 