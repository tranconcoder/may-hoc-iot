import type { TrafficLightEnum } from "../enums/trafficLight.enum";

export interface ViolationLicensePlate {
  camera_id: string;
  image_id: string;
  inference_time: number;
  license_plates: Record<number, string>;
  violations: Array<{
    id: number;
    type: TrafficLightEnum;
  }>
}

