import cameraModel from "../models/camera.model"

export default new class CameraService {
    async create(
        camera_name: string,
        camera_location: string,
        camera_status: boolean,
    ) {
        return await cameraModel.create({
            camera_name,
            camera_location,
            camera_status,
        })
    }


    //
    // GET ALL CAMERAS
    //
    async getAvailableCameraCount() {
        return await cameraModel.countDocuments({
            camera_status: true,
        })
    }

    async getCameraById(camera_id: string) {
        
    }
}
