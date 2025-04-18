import _ from "lodash"
import cameraModel from "../models/camera.model"
import crypto from 'crypto'

export default new class CameraService {
    async create(
        camera_name: string,
        camera_location: string,
    ) {
        const apiKey = crypto.randomBytes(32).toString('hex')

        const result = await cameraModel.create({
            camera_name,
            camera_location,
            camera_status: true,
            camera_api_key: apiKey,
        })

        return _.omit(result, "camera_api_key");
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
