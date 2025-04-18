import type { Request } from 'express';
import type { WebSocketCustom } from '../types/ws';
import type { Server as SocketIOServer } from "socket.io"; // Import Socket.IO Server type

// Websocket
import url from "url";
import { WebSocketServer } from "ws";
import { WebSocketSourceEnum } from "../enums/ws.enum";
// Analytics
import { WebsocketAnalytics } from "./websocketAnalytics.service";
// Stream
import {
  readStreamEsp32CamSecurityGateImg,
} from "./stream.service";

// Import the io instance (assuming it's exported from index.ts)
// Adjust the path if necessary
import { io } from "../index";

const websocketAnalytics = new WebsocketAnalytics(0, 0, 10_000);
websocketAnalytics.startAnalytics();

export default function runWebsocketService(wss: WebSocketServer, HOST: string, PORT: number) {
  wss.on(
    "connection",
    async function connection(ws: WebSocketCustom, req: Request) {
      // Validate connection
      const query = url.parse(req.url, true).query;
      const cameraId = query.cameraId as string;
      const apiKey = query.apiKey as string;

      /* ------------------------ Check cameraId and apiKey ----------------------- */
      if (!cameraId || !apiKey) {
        return ws.close();
      }

      /* ----------------------------- Set connection state ----------------------------- */
      ws.id = cameraId;

      ws.on("error", console.error);

      /* ----------------------------- Handle message ----------------------------- */
      ws.on("message", async function message(buffer: Buffer) {
        websocketAnalytics.transferData(buffer.length, 1);

        io.of(`/${cameraId}`).emit("image", buffer);
      });

      switch (ws.source) {
        case WebSocketSourceEnum.ESP32CAM_SECURITY_GATE_SEND_IMG:
          ws.on("message", async function message(buffer: Buffer) {
            websocketAnalytics.transferData(buffer.length, 1);
            readStreamEsp32CamSecurityGateImg.push(buffer); // Keep if needed

            // Emit the raw buffer via Socket.IO
            io.emit("image", buffer); // Emit raw buffer
            console.log('Emitted raw image buffer via Socket.IO'); // Optional: for debugging
          });
          break;

        case WebSocketSourceEnum.INVALID_SOURCE:
        default:
          console.log("Source is not valid!");
          ws.close();
      }
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
