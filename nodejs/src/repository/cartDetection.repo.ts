import carDetectionModel from "../models/carDetection.model";

export const createCarDetection = async (data: any) => {
    const carDetection = await carDetectionModel.create(data);
    return carDetection;
}


