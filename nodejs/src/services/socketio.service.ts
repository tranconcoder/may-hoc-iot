import type { Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";

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
      console.log(
        "MESSAGE :::::::::::::::::::::: Received message via Socket.IO:",
        data
      );
      // Forward message to all clients
      socket.broadcast.emit("message", data);
    });

    // Listen for detection results from Python client
    socket.on("dentinhieu", (data: any) => {
      console.log(
        `DENTINHIEU:::::::::::::::::::::: Received detection results via Socket.IO from ${socket.id}:`,
        data
      );

      // Forward traffic sign detection data to all clients (including sender)
      socket.broadcast.emit("dentinhieu", data);
    });

    socket.on("giaothong", (data: any) => {
      console.log(
        `GIAOTHONG:::::::::::::::::::::: Received traffic data via Socket.IO from ${socket.id}`
      );

      // Process traffic detection results
      if (data.detections && Array.isArray(data.detections)) {
        const vehicleCount = data.detections.length;
        console.log(
          `Detected ${vehicleCount} vehicles with inference time: ${data.inference_time?.toFixed(
            2
          )}ms`
        );

        // Count vehicles by type
        const vehicleCounts = data.detections.reduce(
          (acc: Record<string, number>, detection: any) => {
            const vehicleType = detection.class;
            acc[vehicleType] = (acc[vehicleType] || 0) + 1;
            return acc;
          },
          {}
        );

        console.log("Vehicle counts by type:", vehicleCounts);

        // Forward vehicle detection data to all clients with original event name
        socket.broadcast.emit("giaothong", data);

        // Note: We keep this for backward compatibility with existing web clients
        // In the future, consider standardizing on just the 'giaothong' event
        io.emit("trafficUpdate", {
          vehicleCount,
          vehicleCounts,
          detections: data.detections,
          timestamp: data.timestamp || Date.now(),
          inferenceTime: data.inference_time,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket.IO Client disconnected: ${socket.id}`);
    });
  });

  console.log("Socket.IO service logic initialized.");

  io.listen(3001);

  return io
}
