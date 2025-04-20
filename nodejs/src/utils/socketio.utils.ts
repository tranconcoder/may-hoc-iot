import { Socket } from "socket.io";
import trafficLightModel from "@/models/trafficLight.model.js";
import carDetectionModel from "@/models/carDetection.model.js";
import cameraModel from "@/models/camera.model.js";
import violationService from "@/services/violation.service.js";
import cameraImageModel from "@/models/cameraImage.model.js";

/* -------------------------------------------------------------------------- */
/*                            Use strategy pattern                            */
/* -------------------------------------------------------------------------- */
const strategy = {
  /* ---------------------------- Join room handler --------------------------- */
  join_camera: handleJoinCameraEvent,
  join_all_camera: handleJoinAllCameraEvent,
  leave_camera: handleLeaveCameraEvent,


  /* ------------------------------ Event handler ----------------------------- */
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
/*                          Handle 'join_camera' event handler                */
/* -------------------------------------------------------------------------- */
export async function handleJoinCameraEvent(this: Socket, cameraId: string) {
  const socket = this
  socket.join(`camera_${cameraId}`);
}

/* -------------------------------------------------------------------------- */
/*                          Handle 'join_all_camera' event handler          */
/* -------------------------------------------------------------------------- */
export async function handleJoinAllCameraEvent(this: Socket) {
  const socket = this;

  console.log("join_all_camera by client:", socket.id);

  const cameraIds = await cameraModel
    .find(
      {},
      { _id: 1 }
    )
    .lean();

  cameraIds.forEach((id) => {
    socket.join(`camera_${id._id}`);
  })
}

/* -------------------------------------------------------------------------- */
/*                          Handle 'leave_camera' event handler              */
/* -------------------------------------------------------------------------- */
export async function handleLeaveCameraEvent(this: Socket, cameraId: string) {
  const socket = this;
  socket.leave(`camera_${cameraId}`);
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

  let maxDetection = { confidence: 0 };
  data.detections.forEach((element: any) => {
    if (maxDetection.confidence < element.confidence) {
      maxDetection = element;
    }
  });

  socket.broadcast.emit("dentinhieu", {
    cameraId: data.cameraId,
    imageId: data.imageId,
    traffic_status: data.traffic_status,
    detection: maxDetection,
    inference_time: data.inference_time,
    image_dimensions: data.image_dimensions,
    created_at: data.created_at,
  });

  console.log('Traffic light detection data', data);

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

  try {
    const imageBuffer = await cameraImageModel.findById(data.image_id);
    if (!imageBuffer) throw new Error("Not found image buffer!");

    socket.emit("vipham", {
      camera_id: data.camera_id,
      image_id: data.image_id,
      vehicleIds: await violationService.detectRedLightViolation(data),
      buffer: imageBuffer.image,
      detections: data.detections,
    });

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
        console.log("Car detection created successfully");
      })
      .catch((err) => {
        throw new Error("Car detection creation failed: " + err);
      });
  } catch (error: any) {
    console.log("Error handleGiaoThongEvent: ", error);
  }
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