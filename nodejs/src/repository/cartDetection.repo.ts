import carDetectionModel from "@/models/carDetection.model.js";

export const createCarDetection = async (data: any) => {
    const carDetection = await carDetectionModel.create(data);
    return carDetection;
}


