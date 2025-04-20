import { Schema, model } from 'mongoose';
import { CAMERA_MODEL_NAME } from '@/models/camera.model.js';
import { CAMERA_IMAGE_MODEL_NAME } from '@/models/cameraImage.model.js';


export const CART_DETECTION_MODEL_NAME = 'CarDetection';
export const CART_DETECTION_COLLECTION_NAME = 'car_detections';


export const cartDetectionSchema = new Schema({
    /* ------------------------------- Foreign key ------------------------------ */
    camera_id: { type: Schema.Types.ObjectId, ref: CAMERA_MODEL_NAME, required: true },
    image_id: { type: Schema.Types.ObjectId, ref: CAMERA_IMAGE_MODEL_NAME, required: true },

    /* -------------------------------- Detection ------------------------------- */
    detections: {
        type: [
            {
                id: { type: Number },
                class: { type: String, required: true },
                confidence: { type: Number, required: true },
                bbox: {
                    x1: { type: Number, required: true },
                    y1: { type: Number, required: true },
                    x2: { type: Number, required: true },
                    y2: { type: Number, required: true },
                    width: { type: Number, required: true },
                    height: { type: Number, required: true },
                }
            }
        ],
        required: true
    },
    inference_time: { type: Number, required: true },
    vehicle_count: {
        total_up: { type: Number, required: true },
        total_down: { type: Number, required: true },
        by_type_up: {
            car: { type: Number, required: true },
            truck: { type: Number, required: true },
            bus: { type: Number, required: true },
            motorcycle: { type: Number, required: true },
            bicycle: { type: Number, required: true },
        },
        by_type_down: {
            car: { type: Number, required: true },
            truck: { type: Number, required: true },
            bus: { type: Number, required: true },
            motorcycle: { type: Number, required: true },
            bicycle: { type: Number, required: true },
        },
    },
    tracks: {
        type: [
            {
                id: { type: Number, required: true },
                positions: {
                    type: [
                        {
                            x: { type: Number, required: true },
                            y: { type: Number, required: true },
                            time: { type: Number, required: true },
                        }
                    ],
                    default: []
                },
                class: { type: String, required: true },
            }
        ],
        default: []
    },
    new_crossings: {
        type: [
            {
                id: { type: String, required: true },
                direction: { type: String, required: true },
            }
        ],
        default: []
    },

    /* ------------------------------- Image dimensions ------------------------------ */
    image_dimensions: {
        width: { type: Number, required: true },
        height: { type: Number, required: true },
    },
}, {
    timestamps: {
        createdAt: 'created_at',
    },
    collection: CART_DETECTION_COLLECTION_NAME,
});

export default model(CART_DETECTION_MODEL_NAME, cartDetectionSchema);