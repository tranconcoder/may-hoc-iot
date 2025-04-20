import cameraModel, { CameraModel } from "@/models/camera.model.js";
import trafficLightService from "./trafficLight.service.js";
import { TrafficLightEnum } from "@/enums/trafficLight.enum.js";
import { Detect } from "./violation.service.d.js";

export default new class ViolationService {
    async detectRedLightViolation(data: Detect) {
        const { camera_id, tracks } = data;

        const camera = await cameraModel.findById(camera_id);
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