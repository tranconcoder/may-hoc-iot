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
}) {
  const socket = this;

  socket.broadcast.emit("image", {
    cameraId: data.cameraId,
    imageId: data.imageId,
    width: data.width,
    height: data.height,
    buffer: data.buffer,
  })
}

/* -------------------------------------------------------------------------- */
/*                      Handle 'dentinhieu' event handler                      */
/* -------------------------------------------------------------------------- */
export async function handleDenTinHieuEvent(this: Socket, data: any) {
  const socket = this;

  // Forward traffic sign detection data to all clients (including sender)
  socket.broadcast.emit("dentinhieu", data);

  await trafficLightModel
    .create(data)
    .then((res) => {
      // console.log("Traffic light detection created successfully", res);
    })
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
    .create(data)
    .then((res) => {
      // console.log("Car detection created successfully", res);
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