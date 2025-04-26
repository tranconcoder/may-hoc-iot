import { Schema, model } from "mongoose";
import { timestamps } from "@/config/model.config.js";
import { CAMERA_MODEL_NAME } from "@/models/camera.model.js";

export const LICENSE_PLATE_DETECTED_MODEL_NAME = "LicensePlateDetected";
export const LICENSE_PLATE_DETECTED_COLLECTION_NAME = "license_plate_detected";

export interface LicensePlateDetectedModel {
  camera_id: Schema.Types.ObjectId;
  license_plate: string;
  detected_at: Date;
  image_buffer: Buffer;
}

export const licensePlateDetectedSchema = new Schema<LicensePlateDetectedModel>(
  {
    camera_id: {
      type: Schema.Types.ObjectId,
      ref: CAMERA_MODEL_NAME,
      required: true,
      index: true,
    },
    license_plate: {
      type: String,
      required: true,
      index: true,
    },
    detected_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    image_buffer: {
      type: Buffer,
      required: true,
    },
  },
  {
    collection: LICENSE_PLATE_DETECTED_COLLECTION_NAME,
    timestamps: timestamps,
  }
);

// Create index for efficient searches
licensePlateDetectedSchema.index({ license_plate: 1, detected_at: -1 });
licensePlateDetectedSchema.index({ camera_id: 1, detected_at: -1 });

export default model(
  LICENSE_PLATE_DETECTED_MODEL_NAME,
  licensePlateDetectedSchema
);
