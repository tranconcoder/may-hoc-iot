import { timestamps } from '@/config/model.config.js';
import {Schema, model} from 'mongoose';

export interface ViolationLicensePlate {
    cameraId: string;
    vehicleId: number;
    licensePlate: string;
    violations: string[];
}

export const VIOLATION_MODEL_NAME = 'ViolationLicensePlate';
export const VIOLATION_COLLECTION_NAME = 'violationLicensePlate';

export const violationLicensePlateSchema = new Schema({
    cameraId: {
        type: String,
        required: true,
    },
    vehicleId: {
        type: Number,
        required: true,
    },
    licensePlate: {
        type: String,
        required: true,
    },
    violations: {
        type: [String],
        required: true,
    },
}, {
    collection: VIOLATION_COLLECTION_NAME,
    timestamps: timestamps
})

export default model(VIOLATION_MODEL_NAME, violationLicensePlateSchema);