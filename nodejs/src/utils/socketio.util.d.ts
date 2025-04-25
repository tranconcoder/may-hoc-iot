import { TrafficViolation } from "@/enums/trafficViolation.enum.ts";

export interface ViolationLicensePlateDetect {
  camera_id: string;
  image_id: string;
  inference_time: number;
  license_plates: Record<numberstring>;
  violations: Array<{
    id: number;
    type: TrafficViolation;
  }>
}
