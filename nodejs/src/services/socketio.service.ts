import type { Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import handleEvent from "../utils/socketio.utils.js";
import cameraModel from "@/models/camera.model.js";

export function runSocketIOService(server: Server): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket"],
  }); // Store the instance

  io.on("connection", async (socket: Socket) => {
    console.log(`SOCKET.IO CLIENT CONNECTED: ${socket.id}`);


    /* -------------------------------------------------------------------------- */
    /*                              Join room handler                             */
    /* -------------------------------------------------------------------------- */

    /* ------------------ Setup 'join_camera' event handler ------------------- */
    socket.on("join_camera", handleEvent("join_camera").bind(socket));

    /* ------------------ Setup 'join_all_camera' event handler ----------------- */
    socket.on("join_all_camera", handleEvent("join_all_camera").bind(socket));

    socket.on("leave_camera", handleEvent("leave_camera").bind(socket));



    /* -------------------------------------------------------------------------- */
    /*                                Event handler                               */
    /* -------------------------------------------------------------------------- */

    /* ---------------------------- Set 'image' event handler ---------------------------- */
    socket.on("image", handleEvent("image").bind(socket));

    /* ---------------------------- Set 'dentinhieu' event handler ---------------------------- */
    socket.on("dentinhieu", handleEvent("dentinhieu").bind(socket));

    /* ---------------------------- Set 'giaothong' event handler ---------------------------- */
    socket.on("giaothong", handleEvent("giaothong").bind(socket));

    /* ---------------------------- Set 'license_plate' event handler ---------------------------- */
    socket.on("license_plate", handleEvent("license_plate").bind(socket));

    /* ---------------------------- Set 'license_plate_ocr' event handler ---------------------------- */
    socket.on(
      "license_plate_ocr",
      handleEvent("license_plate_ocr").bind(socket)
    );

    socket.on("disconnect", () => {
      console.log(`Socket.IO Client disconnected: ${socket.id}`);
    });
  });

  console.log("Socket.IO service logic initialized.");

  io.listen(3001);

  return io;
}
