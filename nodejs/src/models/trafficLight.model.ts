import { Schema, model } from 'mongoose';
import ms from 'ms';

export const TRAFFIC_LIGHT_MODEL_NAME = 'TrafficLight';
export const TRAFFIC_LIGHT_COLLECTION_NAME = 'traffic_lights';

export const trafficLightSchema = new Schema({
    traffic_status: { type: String, required: true },
    detections: {
        type: [{
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
        }],
        default: []
    },
    inference_time: { type: Number, required: true },
    image_dimensions: {
        width: { type: Number, required: true },
        height: { type: Number, required: true },
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: false
    },
    collection: TRAFFIC_LIGHT_COLLECTION_NAME,
});

trafficLightSchema.index({ created_at: -1 }, { expireAfterSeconds: ms('1 hour') / 1000 });

export default model(TRAFFIC_LIGHT_MODEL_NAME, trafficLightSchema);