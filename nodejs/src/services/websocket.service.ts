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
import { InferRawDocType } from 'mongoose';

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
      let camera: CameraModel | null;
      let ioClientConnect: Socket;

      try {
        /* ------------------------ Check cameraId and apiKey ----------------------- */
        if (!cameraId || !apiKey) throw new Error("Invalid header");

        /* -------------------------- Check camera is valid ------------------------- */
        camera = await cameraModel.findOne({
          _id: cameraId,
          camera_api_key: apiKey,
        });
        if (!camera) throw new Error("Invalid header");

        /* -------------------------- Setup socketio client ------------------------- */
        const wsUrl = `ws://${envConfig.HOST}:3001${CAMERA_NAMESPACE_START}${cameraId}`

        ioClientConnect = ioClient(wsUrl, {
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 5000,
        });

        ioClientConnect.connect();

        ioClientConnect.on("connect", () => {
          console.log("Connected to camera namespace");
        });

        ioClientConnect.on("timeout", () => {
          console.log("Timeout connecting to camera namespace");
          ws.close();
        });

        ioClientConnect.on("error", (error) => {
          console.error("Error connecting to camera namespace", error);
          ws.close();
        });
      } catch (error: any) {
        console.log(error.message);
        ws.close();
      }

      ws.id = cameraId;

      ws.on("error", console.error);

      /* ----------------------------- Handle message ----------------------------- */
      ws.on("message", async function message(buffer: Buffer) {
        websocketAnalytics.transferData(buffer.length, 1);

        ioClientConnect.emit("image", buffer);
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
