import { Schema, model } from "mongoose";
import { timestamps } from "../config/model.config";

export const CAMERA_MODEL_NAME = "Camera";
export const CAMERA_COLLECTION_NAME = "cameras";

export const cameraSchema = new Schema({
    camera_name: { type: String, required: true, unique: true },
    camera_location: { type: String, required: true },
    camera_status: { type: Boolean, default: false },
    camera_api_key: { type: String, required: true },
}, {
    timestamps,
    collection: CAMERA_COLLECTION_NAME,
});

export default model(CAMERA_MODEL_NAME, cameraSchema);
