import cameraModel, { CameraModel } from "@/models/camera.model.js";
import trafficLightService from "./trafficLight.service.js";
import { TrafficLightEnum } from "@/enums/trafficLight.enum.js";
import { Detect } from "./violation.service.d.js";
import { CarEnum } from "@/enums/car.enum.js";
import { ViolationLicensePlateDetect } from "@/utils/socketio.util.d.js";
import { ViolationStatus } from "@/enums/trafficViolation.enum.js";
import violationModel from "@/models/violation.model.js";
import cameraImageModel from "@/models/cameraImage.model.js";

export default new (class ViolationService {
  /* -------------------------------------------------------------------------- */
  /*                                   Get all                                  */
  /* -------------------------------------------------------------------------- */
  async getAllViolations() {
    // Group by license_plate and return all violations for each license plate
    return await violationModel.aggregate([
      {
        $group: {
          _id: "$license_plate",
          license_plate: { $first: "$license_plate" },
          violations: {
            $push: {
              _id: "$_id",
              camera_id: "$camera_id",
              violation_type: "$violation_type",
              violation_status: "$violation_status",
              created_at: "$createdAt",
              updated_at: "$updatedAt"
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          license_plate: 1,
          violations: 1
        }
      }
    ]);
  }


  async getImageBuffer(violation_id: string) {
    const violation = await violationModel.findById(violation_id);
    console.log(violation);
    if (!violation?.image_buffer) {
      throw new Error("Violation not found");
    }

    return violation.image_buffer;
  }

  /* -------------------------------------------------------------------------- */
  /*                                Update status                               */
  /* -------------------------------------------------------------------------- */
  async updateViolationStatus(violationId: string, status: ViolationStatus) {
    const violation = await violationModel.findByIdAndUpdate(
      violationId,
      { violation_status: status },
      { new: true }
    );

    if (!violation) {
      throw new Error("Violation not found");
    }

    return violation;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   Create                                   */
  /* -------------------------------------------------------------------------- */
  async saveViolation(data: ViolationLicensePlateDetect) {
    const violationList = Object.entries(data.license_plates).flatMap(([id, license_plate]) => {
      const vehicleViolation = data.violations.filter((violation) => violation.id === Number(id));

      return vehicleViolation.map((violation) => {
        return {
          license_plate: license_plate,
          violation_type: violation.type,
          violation_status: ViolationStatus.PENDING,
        };
      });
    });

    await Promise.all(violationList.map(async (violation) => {
      await violationModel.findOneAndUpdate({
        license_plate: violation.license_plate,
        camera_id: data.camera_id,
        violation_type: violation.violation_type,
        violation_status: ViolationStatus.PENDING,
        created_at: { $gte: new Date(Date.now() - 1000 * 60) }, // Thời gian lưu không quá 1 phút so với hiện tại mongoose query
      }, {
        image_buffer: await cameraImageModel.findById(data.image_id).then(x => x?.image),
      }, {
        upsert: true,
        new: true,
      });
    }));
  }

  /* -------------------------------------------------------------------------- */
  /*                                   Detect                                   */
  /* -------------------------------------------------------------------------- */
  async detectRedLightViolation(data: Detect, camera: CameraModel) {
    let { camera_id, detections, tracks, image_dimensions } = data;

    const detectionIds = detections.map((detection) => detection.id);
    const track_line_y = camera.camera_track_line_y;

    tracks = tracks.filter((vehicle) => {
      return detectionIds.includes(vehicle.id);
    });

    const vehicleIds = await Promise.all(
      tracks.map(async (vehicle) => {
        /* ------------------------ Get current traffic light ----------------------- */
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

        /* ------------------------ Detect red light violation ----------------------- */
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
            return vehicle.id;
          }
        }

        return null;
      })
    ).then((ids) => ids.filter((id) => id !== null));

    if (vehicleIds.length > 0) {
      console.log("Red light violation ids: ", vehicleIds);
    }

    return vehicleIds;
  }

  async laneEncroachment(
    detections: Detect["detections"],
    imageDimensions: Detect["image_dimensions"],
    camera: CameraModel
  ) {
    const { camera_lane_vehicles } = camera;
    const camera_lane_track_point = [...camera.camera_lane_track_point, 100];

    const vehicleViolationIds = [];

    /* ------------------------ Detect lane encroachment ----------------------- */
    for (const detection of detections) {
      const { id, class: vehicleClass, bbox } = detection;
      const { x1, x2 } = bbox;

      /* ------------------------ Get lane start and end index ----------------------- */
      const laneStartIndex = camera_lane_track_point.findIndex(
        (item) =>
          item * (imageDimensions.width / 100) > x1 * imageDimensions.width
      );
      const laneEndIndex = camera_lane_track_point.findIndex(
        (item) =>
          item * (imageDimensions.width / 100) > x2 * imageDimensions.width
      );

      const vehiclesInLane = camera_lane_vehicles.slice(
        laneStartIndex,
        laneEndIndex + 1
      );

      /* ------------------------ Detect lane encroachment ----------------------- */
      const isViolation = vehiclesInLane.some(
        (laneVehicle) =>
          !laneVehicle.includes(CarEnum.ANY) &&
          !laneVehicle.includes(vehicleClass as CarEnum)
      );

      if (isViolation) {
        vehicleViolationIds.push(id);
      }
    }

    if (vehicleViolationIds.length > 0) {
      console.log("Lane encroachment ids: ", vehicleViolationIds);
    }

    return vehicleViolationIds;
  }
})();
