import ImagesModel from "../models/images.model";

export default new class ImagesService {
    async uploadImage(cameraId: string, image: Buffer, imageType: string, imageWidth: number, imageHeight: number) {
        const imageModel = await ImagesModel.create({
            image_camera: cameraId,
            image_buffer: image,
            image_type: imageType,
            image_width: imageWidth,
            image_height: imageHeight,
            image_size: image.length,
        })

        return imageModel;
    }
}