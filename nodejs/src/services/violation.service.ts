import cameraModel, { CameraModel } from "@/models/camera.model.js";
import trafficLightService from "./trafficLight.service.js";
import { TrafficLightEnum } from "@/enums/trafficLight.enum.js";
import { Detect } from "./violation.service.d.js";

export default new (class ViolationService {
  async detectRedLightViolation(data: Detect) {
    let { camera_id, detections, tracks, image_dimensions } = data;

    const camera = await cameraModel.findById(camera_id);
    if (!camera) throw new Error("Not found camera!");

    const detectionIds = detections.map((detection) => detection.id);
    const track_line_y = camera.camera_track_line_y;

    tracks = tracks.filter((vehicle) => {
      return detectionIds.includes(vehicle.id);
    });

    const vehicleIds = await Promise.all(
      tracks.map(async (vehicle) => {
        const trafficLightStatusList = (
          await Promise.all(
            vehicle.positions.map(async ({ time, x, y }) => {
              return {
                trafficStatus: await trafficLightService.getTrafficLightByTime(
                  time
                ),
                overcomeRedLightLine:
                  y < track_line_y * (image_dimensions.height / 100), // Vượt qua đèn đỏ
              };
            })
          )
        ).filter((item) => item.trafficStatus !== null);

        for (let i = 0; i < trafficLightStatusList.length - 1; i++) {
          const trafficLightStatusPair = [
            trafficLightStatusList[i],
            trafficLightStatusList[i + 1],
          ];
          // console.log();
          // console.log("================ DETECT VIOLATION ==================")
          // console.log("Vehicle id: ", vehicle.id);
          // console.log("Traffic light status pair: ", trafficLightStatusPair.map((item) => item.trafficStatus));
          // console.log("Overcome red light line: ", trafficLightStatusPair.map((item) => item.overcomeRedLightLine));
          // console.log("================ DETECT VIOLATION ==================")
          // console.log();

          if (
            trafficLightStatusPair[0].trafficStatus === TrafficLightEnum.RED &&
            trafficLightStatusPair[1].trafficStatus === TrafficLightEnum.RED &&
            trafficLightStatusPair[0].overcomeRedLightLine === false &&
            trafficLightStatusPair[1].overcomeRedLightLine === true
          ) {
            console.log("Violation detected: ", vehicle.id);
            return vehicle.id;
          }
        }

        return null;
      })
    ).then((ids) => ids.filter((id) => id !== null));

    return vehicleIds;
  }

  async laneEncroachment(data: Detect) {
    const { camera_id, detections, tracks, image_dimensions } = data;
  }
})();
