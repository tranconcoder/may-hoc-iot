import { Server as SocketIOServer, Socket } from "socket.io";

// Store the io instance globally within this module
let ioInstance: SocketIOServer | null = null;

/**
 * Initializes and runs the Socket.IO connection logic.
 * @param io The Socket.IO server instance.
 */
export function runSocketIOService(io: SocketIOServer): void {
  ioInstance = io; // Store the instance

  io.on("giaothong", (data: any) => {
    console.log("GIAOTHONG___IO :::::::::::::::::::::: Received traffic data via Socket.IO:", data);
  });

  io.on("connection", (socket: Socket) => {
    console.log(`SOCKET.IO CLIENT CONNECTED: ${socket.id}`);

    socket.on("message", (data: any) => {
      console.log("MESSAGE :::::::::::::::::::::: Received message via Socket.IO:", data);
    });

    // Listen for detection results from Python client
    socket.on("dentinhieu", (data: any) => {
      console.log(`DENTINHIEU:::::::::::::::::::::: Received detection results via Socket.IO from ${socket.id}:`, data);
      // Process detection results here if needed
    });

    socket.on("giaothong", (data: any) => {
        console.log(`GIAOTHONG:::::::::::::::::::::: Received traffic data via Socket.IO from ${socket.id}`);
        
        // Process traffic detection results
        if (data.detections && Array.isArray(data.detections)) {
            const vehicleCount = data.detections.length;
            console.log(`Detected ${vehicleCount} vehicles with inference time: ${data.inference_time?.toFixed(2)}ms`);
            
            // Count vehicles by type
            const vehicleCounts = data.detections.reduce((acc: Record<string, number>, detection: any) => {
                const vehicleType = detection.class;
                acc[vehicleType] = (acc[vehicleType] || 0) + 1;
                return acc;
            }, {});
            
            console.log("Vehicle counts by type:", vehicleCounts);
            
            // You can broadcast this data to web clients if needed
            socket.broadcast.emit("trafficUpdate", {
                vehicleCount,
                vehicleCounts,
                detections: data.detections,
                timestamp: data.timestamp || Date.now(),
                inferenceTime: data.inference_time
            });
        }
    })

    socket.on("disconnect", () => {
      console.log(`Socket.IO Client disconnected: ${socket.id}`);
    });
  });

  console.log("Socket.IO service logic initialized.");
}

/**
 * Emits image data to all connected Socket.IO clients.
 * @param imageBuffer The raw image buffer.
 */
export function emitImage(imageBuffer: Buffer): void {
  if (ioInstance) {
    ioInstance.emit("image", imageBuffer);
    // console.log('Emitted raw image buffer via Socket.IO'); // Optional: for debugging
  } else {
    console.error("Socket.IO instance not initialized. Cannot emit image.");
  }
}
