import cameraModel, { CameraModel } from "@/models/camera.model.js";
import trafficLightService from "./trafficLight.service.js";
import { TrafficLightEnum } from "@/enums/trafficLight.enum.js";

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
    created_at: number;
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
        const { cameraId, tracks } = data;

        const camera = await cameraModel.findById(cameraId);
        if (!camera) throw new Error("Not found camera!");

        const track_line_y = camera.camera_track_line_y;

        const vehicleIds = await Promise.all(tracks.map(async (vehicle) => {
            const trafficLightStatusList = await Promise.all(vehicle.positions.map(async ({ time, x, y }) =>
            ({
                trafficStatus: await trafficLightService.getTrafficLightByTime(time),
                overcomeRedLightLine: y > track_line_y // Vượt qua đèn đỏ
            })
            ))

            for (let i = 0; i < trafficLightStatusList.length - 1; i++) {
                const trafficLightStatusPair = [trafficLightStatusList[i], trafficLightStatusList[i + 1]];

                if (
                    trafficLightStatusPair[0].trafficStatus === TrafficLightEnum.GREEN &&
                    trafficLightStatusPair[1].trafficStatus === TrafficLightEnum.RED &&
                    trafficLightStatusPair[0].overcomeRedLightLine === false &&
                    trafficLightStatusPair[1].overcomeRedLightLine === true
                ) {
                    console.log("Violation detected: ", vehicle.id);
                    return vehicle.id;
                }
            }

            return null;
        })).then(ids => ids.filter(id => id !== null));

        return vehicleIds;
    }
}