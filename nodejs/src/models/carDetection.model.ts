import { Schema, model } from 'mongoose';

export const CART_DETECTION_MODEL_NAME = 'CarDetection';
export const CART_DETECTION_COLLECTION_NAME = 'car_detections';

export const cartDetectionSchema = new Schema({
    detections: {
        type: [
            {
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
        default: []
    },
    inference_time: { type: Number, required: true },
    image_dimensions: {
        width: { type: Number, required: true },
        height: { type: Number, required: true },
    },
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
        current: {
            car: { type: Number, required: true },
            truck: { type: Number, required: true },
            bus: { type: Number, required: true },
            motorcycle: { type: Number, required: true },
            bicycle: { type: Number, required: true },
        }
    },
    counting_line: {
        y: { type: Number, required: true },
        start_x: { type: Number, required: true },
        end_x: { type: Number, required: true },
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: false
    },
    collection: CART_DETECTION_COLLECTION_NAME,
});

export default model(CART_DETECTION_MODEL_NAME, cartDetectionSchema);