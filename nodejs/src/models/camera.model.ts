import { Schema, model } from "mongoose";
import { timestamps } from "@/config/model.config.js";
import { CarEnum } from "@/enums/car.enum.js";

export const CAMERA_MODEL_NAME = "Camera";
export const CAMERA_COLLECTION_NAME = "cameras";

export interface CameraModel {
    camera_name: string;
    camera_location: string;
    camera_status: boolean;
    camera_api_key: string;
    camera_track_line_y: number;
    camera_lane_track_point: Array<number>;
    camera_lane_vehicles: Array<Array<CarEnum>>;
}

export const cameraSchema = new Schema<CameraModel>({
    camera_name: { type: String, required: true, unique: true },
    camera_location: { type: String, required: true },
    camera_status: { type: Boolean, default: false },
    camera_api_key: { type: String, required: true },
    camera_track_line_y: { type: Number, default: 50, min: 0, max: 100 }, // Percentage of the image height
    camera_lane_track_point: { type: [Number], default: [] },
    camera_lane_vehicles: {
        type: [[String]],
        default: function () {
            return Array.from({ length: this.camera_lane_track_point.length + 1 }, () => [CarEnum.ANY]);
        }
    },
}, {
    timestamps,
    collection: CAMERA_COLLECTION_NAME,
});

export default model(CAMERA_MODEL_NAME, cameraSchema);
