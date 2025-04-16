import type { Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import carDetectionModel from "../models/carDetection.model";
import trafficLightModel from "../models/trafficLight.model";

/**
 * Initializes and runs the Socket.IO connection logic.
 * @param io The Socket.IO server instance
 */
export function runSocketIOService(server: Server): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  }); // Store the instance

  io.on("connection", (socket: Socket) => {
    console.log(`SOCKET.IO CLIENT CONNECTED: ${socket.id}`);

    socket.on("message", (data: any) => {
      socket.broadcast.emit("message", data);
    });

    // Listen for detection results from Python client
    socket.on("dentinhieu", async (data: any) => {
      // Forward traffic sign detection data to all clients (including sender)
      socket.broadcast.emit("dentinhieu", data);

      await trafficLightModel
        .create(data)
        .then((res) => {
          console.log("Traffic light detection created successfully", res);
        })
        .catch((err) => {
          console.log("Traffic light detection creation failed", err);
        });
    });

    socket.on("giaothong", async (data: any) => {
      // Forward vehicle detection data to all clients with original event name
      socket.broadcast.emit("giaothong", data);

      await carDetectionModel
        .create(data)
        .then((res) => {
          console.log("Car detection created successfully", res);
        })
        .catch((err) => {
          console.log("Car detection creation failed", err);
        });
    });

    socket.on("car", (data: any) => {
      // Forward vehicle detection data to all clients (including sender)
      console.log(data);

      socket.broadcast.emit("car", data.image_data);
    });

    socket.on("license_plate", (data: any) => {
      // Forward license plate detection data to all clients (including sender)
      console.log(data);
      socket.broadcast.emit("license_plate", data);
    });

    socket.on("disconnect", () => {
      console.log(`Socket.IO Client disconnected: ${socket.id}`);
    });
  });

  console.log("Socket.IO service logic initialized.");

  io.listen(3001);

  return io;
}
