import SuccessResponse, { CreatedResponse } from "@/core/success.response"
import cameraService from "@/services/camera.service"
import { RequestHandler } from "express"

export default new class CameraController {
    create: RequestHandler<{}, {}, {
        camera_name: string,
        camera_location: string,
        camera_status: boolean,
    }> = async (req, res, next) =>{
        new CreatedResponse({
            message: "Create new camera success",
            metadata: await cameraService.create(req.body.camera_name, req.body.camera_location, req.body.camera_status)
        }).send(res)
    }
}