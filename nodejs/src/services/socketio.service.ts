import type { Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import handleEvent from "../utils/socketio.utils";

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

    /* -------------------------------------------------------------------------- */
    /*                       Setup 'message' event handler                        */
    /* -------------------------------------------------------------------------- */
    socket.on("message", handleEvent("message").bind(socket))

    /* -------------------------------------------------------------------------- */
    /*                      Setup 'dentinhieu' event handler                      */
    /* -------------------------------------------------------------------------- */
    socket.on("dentinhieu", handleEvent("dentinhieu").bind(socket))

    /* -------------------------------------------------------------------------- */
    /*                      Setup 'giaothong' event handler                      */
    /* -------------------------------------------------------------------------- */
    socket.on("giaothong", handleEvent("giaothong").bind(socket))

    /* -------------------------------------------------------------------------- */
    /*                      Setup 'car' event handler                            */
    /* -------------------------------------------------------------------------- */
    socket.on("car", handleEvent("car").bind(socket));

    /* -------------------------------------------------------------------------- */
    /*                      Setup 'license_plate' event handler                  */
    /* -------------------------------------------------------------------------- */
    socket.on("license_plate", handleEvent("license_plate").bind(socket));

    /* -------------------------------------------------------------------------- */
    /*                      Setup 'license_plate_ocr' event handler            */
    /* -------------------------------------------------------------------------- */
    socket.on("license_plate_ocr", handleEvent("license_plate_ocr").bind(socket));

    socket.on("disconnect", () => {
      console.log(`Socket.IO Client disconnected: ${socket.id}`);
    });
  });

  console.log("Socket.IO service logic initialized.");

  io.listen(3001);

  return io;
}
