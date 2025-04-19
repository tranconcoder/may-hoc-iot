import { CameraModel } from "@/models/camera.model";
import trafficLightService from "./trafficLight.service";

interface Detect {
    cameraId: string;
    imageId: string;
    detections: {
        'class': string,
        'confidence': number,
        'bbox': {
            'x1': number,
            'y1': number,
            'x2': number,
            'y2': number,
            'width': number,
            'height': number
        }
    }[];
    inference_time: number;
    image_dimensions: {
        width: number;
        height: number;
    };
    timestamp: number;
    vehicle_count: {
        total_up: number;
        total_down: number;
        by_type_up: {
            [key: string]: number;
        };
        by_type_down: {
            [key: string]: number;
        };
        current: {
            [key: string]: number;
        };
    };
    counting_line: {
        y: number;
        start_x: number;
        end_x: number;
    };
    tracks: {
        id: string;
        positions: {
            x: number;
            y: number;
            time: number;
        }[];
        class: string;
    }[];
    new_crossings: {
        id: string;
        direction: string;
    }[];
}

export default new class ViolationService {
    async detectRedLightViolation(data: Detect) {
        const { cameraId, imageId, detections, inference_time, image_dimensions, timestamp, vehicle_count, counting_line, tracks, new_crossings } = data;

        const trafficLight = await trafficLightService.getTrafficLightByTime(timestamp);

        return trafficLight;
    }
}