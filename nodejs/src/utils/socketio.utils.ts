import { Socket } from "socket.io";
import trafficLightModel from "../models/trafficLight.model";
import carDetectionModel from "@/models/carDetection.model";

/* -------------------------------------------------------------------------- */
/*                            Use strategy pattern                            */
/* -------------------------------------------------------------------------- */
const strategy = {
  message: handleMessageEvent,
  image: handleImageEvent,
  dentinhieu: handleDenTinHieuEvent,
  giaothong: handleGiaoThongEvent,
  license_plate: handleLicensePlateEvent,
  license_plate_ocr: handleLicensePlateOcrEvent,
}

export default function handleEvent(event: keyof typeof strategy) {
  const handler = strategy[event];

  return handler;
}

/* -------------------------------------------------------------------------- */
/*                          Handle 'message' event handler                     */
/* -------------------------------------------------------------------------- */
export async function handleMessageEvent(this: Socket, data: any) {
  const socket = this;

  socket.broadcast.emit("message", data);
}

/* -------------------------------------------------------------------------- */
/*                          Handle 'image' event handler                       */
/* -------------------------------------------------------------------------- */
export async function handleImageEvent(this: Socket, data: {
  cameraId: string;
  imageId: string;
  width: number;
  height: number;
  buffer: Buffer;
  created_at: number;
  track_line_y: number;
}) {
  const socket = this;

  socket.broadcast.emit("image", {
    cameraId: data.cameraId,
    imageId: data.imageId,
    width: data.width,
    height: data.height,
    buffer: data.buffer,
    created_at: data.created_at,
    track_line_y: data.track_line_y,
  })
}

/* -------------------------------------------------------------------------- */
/*                      Handle 'dentinhieu' event handler                      */
/* -------------------------------------------------------------------------- */
export async function handleDenTinHieuEvent(this: Socket, data: any) {
  const socket = this;

  // Forward traffic sign detection data to all clients (including sender)
  socket.broadcast.emit("dentinhieu", data);

  trafficLightModel
    .create(data)
    .catch((err) => {
      console.log("Traffic light detection creation failed", err);
    });
}

/* -------------------------------------------------------------------------- */
/*                      Handle 'giaothong' event handler                      */
/* -------------------------------------------------------------------------- */
export async function handleGiaoThongEvent(this: Socket, data: any) {
  const socket = this;

  // Forward vehicle detection data to all clients with original event name
  socket.broadcast.emit("giaothong", data);

  await carDetectionModel
    .create({
      camera_id: data.camera_id,
      image_id: data.image_id,
      created_at: data.created_at,
      detections: data.detections,
      inference_time: data.inference_time,
      image_dimensions: data.image_dimensions,
      vehicle_count: data.vehicle_count,
      tracks: data.tracks,
      new_crossings: data.new_crossings,
    })
    .then((newCarDetection) => {
      console.log("Car detection created successfully", newCarDetection);
    })
    .catch((err) => {
      console.log("Car detection creation failed", err);
    });
}

/* -------------------------------------------------------------------------- */
/*                      Handle 'license_plate' event handler                  */
/* -------------------------------------------------------------------------- */
export async function handleLicensePlateEvent(this: Socket, data: any) {
  const socket = this;

  // Forward license plate detection data to all clients (including sender)
  socket.broadcast.emit("license_plate", data);
}

/* -------------------------------------------------------------------------- */
/*                      Handle 'license_plate_ocr' event handler            */
/* -------------------------------------------------------------------------- */
export async function handleLicensePlateOcrEvent(this: Socket, data: any) {
  const socket = this;

  // Forward license plate detection data to all clients (including sender)
  socket.broadcast.emit("license_plate_detect", data);
} 