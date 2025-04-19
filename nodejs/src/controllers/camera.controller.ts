import SuccessResponse, { CreatedResponse, OkResponse } from "@/core/success.response"
import { CameraModel } from "@/models/camera.model"
import cameraService from "@/services/camera.service"
import { RequestHandler } from "express"

export default new class CameraController {
    /* -------------------------------------------------------------------------- */
    /*                                Create camera                               */
    /* -------------------------------------------------------------------------- */
    create: RequestHandler<{}, {}, CameraModel> = async (req, res, next) =>{

        new CreatedResponse({
            message: "Create new camera success",
            metadata: await cameraService.create(req.body.camera_name, req.body.camera_location, req.body.camera_track_line_y)
        }).send(res)
    }

    /* -------------------------------------------------------------------------- */
    /*                                Get all cameras                              */
    /* -------------------------------------------------------------------------- */
    getAllCameras: RequestHandler<{}, {}, {}, {}> = async (req, res, _) => {
        new OkResponse({
            message: "Get all cameras success",
            metadata: await cameraService.getAllCameras()
        }).send(res)
    }
}