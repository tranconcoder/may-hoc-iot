import cameraModel from "../models/camera.model"
import crypto from 'crypto'

export default new class CameraService {
    async create(
        camera_name: string,
        camera_location: string,
        camera_status: boolean,
    ) {
        const apiKey = crypto.randomBytes(32).toString('hex')

        return await cameraModel.create({
            camera_name,
            camera_location,
            camera_status,
            camera_api_key: apiKey,
        })
    }


    /* -------------------------------------------------------------------------- */
    /*                               GET ALL CAMERAS                              */
    /* -------------------------------------------------------------------------- */
    async getAllCameras() {
        return await cameraModel.find({}).lean()
    }

    async getAvailableCameraCount() {
        return await cameraModel.countDocuments({
            camera_status: true,
        })
    }

}
