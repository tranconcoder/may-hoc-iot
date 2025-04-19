import type { Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import handleEvent from "../utils/socketio.utils";
import cameraModel from "@/models/camera.model";

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

    socket.on("join_all_camera", async () => {
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
    })

    /* -------------------------------------------------------------------------- */
    /*                          Set 'image' event handler                         */
    /* -------------------------------------------------------------------------- */
    socket.on("image", handleEvent("image").bind(socket));

    /* -------------------------------------------------------------------------- */
    /*                       Setup 'message' event handler                        */
    /* -------------------------------------------------------------------------- */
    // socket.on("message", handleEvent("message").bind(socket))

    /* -------------------------------------------------------------------------- */
    /*                      Setup 'dentinhieu' event handler                      */
    /* -------------------------------------------------------------------------- */
    socket.on("dentinhieu", handleEvent("dentinhieu").bind(socket));

    /* -------------------------------------------------------------------------- */
    /*                      Setup 'giaothong' event handler                      */
    /* -------------------------------------------------------------------------- */
    socket.on("giaothong", handleEvent("giaothong").bind(socket));

    /* -------------------------------------------------------------------------- */
    /*                      Setup 'license_plate' event handler                  */
    /* -------------------------------------------------------------------------- */
    socket.on("license_plate", handleEvent("license_plate").bind(socket));

    /* -------------------------------------------------------------------------- */
    /*                      Setup 'license_plate_ocr' event handler            */
    /* -------------------------------------------------------------------------- */
    socket.on(
      "license_plate_ocr",
      handleEvent("license_plate_ocr").bind(socket)
    );

    socket.on("disconnect", () => {
      console.log(`Socket.IO Client disconnected: ${socket.id}`);
    });
  });

  console.log("Socket.IO service logic initialized.");

  io.of(/^\/camera_\d+$/).on("connection", (socket: Socket) => {
    console.log(socket);
  });

  io.listen(3001);

  return io;
}
