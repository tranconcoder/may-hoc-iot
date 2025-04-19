import type { Request } from 'express';
import type { WebSocketCustom } from '../types/ws';
import { io as ioClient, Socket } from "socket.io-client";

// Websocket
import url from "url";
import { WebSocketServer } from "ws";
// Analytics
import { WebsocketAnalytics } from "./websocketAnalytics.service";

// Import the io instance (assuming it's exported from index.ts)
// Adjust the path if necessary
import cameraModel, { CameraModel, cameraSchema } from "@/models/camera.model";
import { envConfig } from '@/config';
import { CAMERA_NAMESPACE_START } from '@/config/socketio.config';
import { imageSize } from 'image-size';
import { io } from '..';
import mongoose from 'mongoose';
import cameraImageModel from '@/models/cameraImage.model';


const websocketAnalytics = new WebsocketAnalytics(0, 0, 10_000);
websocketAnalytics.startAnalytics();

export default function runWebsocketService(
  wss: WebSocketServer,
  HOST: string,
  PORT: number
) {
  wss.on(
    "connection",
    async function connection(ws: WebSocketCustom, req: Request) {
      // Validate connection
      const query = url.parse(req.url, true).query;
      const cameraId = query.cameraId as string;
      const apiKey = query.apiKey as string;

      /* -------------------------------------------------------------------------- */
      /*                               Validate header                              */
      /* -------------------------------------------------------------------------- */
      /* ------------------------ Check cameraId and apiKey ----------------------- */
      if (!cameraId || !apiKey) return ws.close();

      /* -------------------------- Check camera is valid ------------------------- */
      const camera = await cameraModel.findOne({
        _id: cameraId,
        camera_api_key: apiKey,
      });
      if (!camera) return ws.close();


      ws.id = cameraId;

      ws.on("error", console.error);

      let width: number;
      let height: number;

      /* ----------------------------- Init image size ---------------------------- */
      ws.once("message", async function message(buffer: Buffer) {
        const dimensions = imageSize(buffer);
        width = dimensions.width;
        height = dimensions.height;
      });

      /* ----------------------------- Handle message ----------------------------- */
      ws.on("message", async function message(buffer: Buffer) {
        websocketAnalytics.transferData(buffer.length, 1)

        const room = `camera_${cameraId}`;
        const imageId = new mongoose.Types.ObjectId();

        io.to(room).emit("image", { cameraId, imageId, width, height, buffer });

        /* ---------------------------- Save image to db ---------------------------- */
        cameraImageModel.create({
          _id: imageId,
          cameraId,
          image: buffer,
          width,
          height,
        })
          .catch(console.error);
      });

    }
  );

  wss.on("listening", () => {
    console.log(`WebSocket Server is listening on ws://${HOST}:${PORT}`);
  });

  wss.on("error", console.log);

  wss.on("close", () => {
    console.log("Websocket is closed!");
  });
}
