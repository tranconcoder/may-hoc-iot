import cameraModel, { CameraModel } from "@/models/camera.model.js";
import trafficLightService from "./trafficLight.service.js";
import { TrafficLightEnum } from "@/enums/trafficLight.enum.js";
import { Detect } from "./violation.service.d.js";
import { CarEnum } from "@/enums/car.enum.js";
import { TrafficViolation } from "@/enums/trafficViolation.model.js";

export default new (class ViolationService {
  async detectRedLightViolation(data: Detect, camera: CameraModel) {
    let { camera_id, detections, tracks, image_dimensions } = data;

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

  async laneEncroachment(
    detections: Detect["detections"],
    camera: CameraModel
  ) {
    const { camera_lane_track_point, camera_lane_vehicles } = camera;

    const vehicleViolationIds = [];

    for (const detection of detections) {
      const { id, class: vehicleClass, bbox } = detection;
      const { x1, x2 } = bbox;
      const laneStartIndex = camera_lane_track_point.findIndex(
        (item) => item > x1
      );
      const laneEndIndex = camera_lane_track_point.findIndex(
        (item) => item > x2
      );

      const vehiclesInLane = camera_lane_vehicles.slice(
        laneStartIndex,
        laneEndIndex + 1
      );

      const isViolation = vehiclesInLane.some(
        (laneVehicle) =>
          !laneVehicle.includes(CarEnum.ANY) &&
          !laneVehicle.includes(detection.class as CarEnum)
      );

      if (isViolation) {
        vehicleViolationIds.push(id);
      }
    }

    return vehicleViolationIds;
  }
})();
