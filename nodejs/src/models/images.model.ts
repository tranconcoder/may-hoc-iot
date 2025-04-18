import {model, Schema} from "mongoose";
import { timestamps } from "../config/model.config";
import { IMAGES_EXPIRE_TIME } from "../config/images.config";
import { CAMERA_MODEL_NAME } from "./camera.model";

export const IMAGES_DOCUMENT_NAME = "images";
export const IMAGES_COLLECTION_NAME = "images";

export const imagesSchema = new Schema({
    image_camera: {
        type: Schema.Types.ObjectId,
        ref: CAMERA_MODEL_NAME,
        required: true,
    },
    image_buffer: {
        type: Buffer,
        required: true,
    },
    image_type: {
        type: String,
        required: true,
    },
    image_size: {
        type: Number,
        required: true,
    },
    image_width: {
        type: Number,
        required: true,
    },
    image_height: {
        type: Number,
        required: true,
    },
    
}, {
    collection: IMAGES_COLLECTION_NAME,
    timestamps: timestamps
});

imagesSchema.index({ createdAt: -1 }, { expireAfterSeconds: IMAGES_EXPIRE_TIME });

export default model(IMAGES_DOCUMENT_NAME, imagesSchema)

