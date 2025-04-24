import SuccessResponse, {
  CreatedResponse,
  OkResponse,
} from "@/core/success.response.js";
import { CameraModel } from "@/models/camera.model.js";
import cameraService from "@/services/camera.service.js";
import { RequestHandler } from "express";

export default new (class CameraController {
  /* -------------------------------------------------------------------------- */
  /*                                Create camera                               */
  /* -------------------------------------------------------------------------- */
  create: RequestHandler<{}, {}, CameraModel> = async (req, res, next) => {
    const {
      camera_name,
      camera_location,
      camera_track_line_y,
      camera_lane_track_point,
      camera_lane_vehicles,
    } = req.body;

    new CreatedResponse({
      message: "Create new camera success",
      metadata: await cameraService.create(
        camera_name,
        camera_location,
        camera_track_line_y,
        camera_lane_track_point,
        camera_lane_vehicles
      ),
    }).send(res);
  };

  /* -------------------------------------------------------------------------- */
  /*                                Get all cameras                              */
  /* -------------------------------------------------------------------------- */
  getAllCameras: RequestHandler<{}, {}, {}, {}> = async (_, res, __) => {
    new OkResponse({
      message: "Get all cameras success",
      metadata: await cameraService.getAllCameras(),
    }).send(res);
  };
})();
