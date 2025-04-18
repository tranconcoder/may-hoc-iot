// Express app
import express from 'express';
import session, { SessionOptions } from 'express-session';
import handleRoute from './routes';
import bodyParser from 'body-parser';

// Handlebars
import path from 'path';
import SetupHandlebars from './services/handlebars.service';

// Https server
import fs from 'fs';

// Websocket Server
import runWebsocketService from './services/websocket.service';
import { WebSocketServer } from 'ws';

// Services
import * as ffmpegService from './services/ffmpeg.service';

// Morgan
import morgan from 'morgan';

// Environments
import { envConfig } from "./config";

// Secure
import cors from "cors";
import { createServer } from "http"; // Import createServer from http
import { runSocketIOService } from './services/socketio.service';
import DBCore from './core/db.core';
import HandleErrorService from './services/handleError.service';

// Constants
const { HOST, PORT } = envConfig;

// SSL Certificates
const privateKey = fs.readFileSync(
  path.join(__dirname, "./assets/certificates/key.pem"),
  "utf8"
);
const certificate = fs.readFileSync(
  path.join(__dirname, "./assets/certificates/cert.pem"),
  "utf8"
);

const credentials = {
  key: privateKey,
  cert: certificate,
};

// Server
const app = express();
// Use createServer from http for simplicity, assuming HTTPS isn't strictly needed for internal Socket.IO
const httpServer = createServer(app); // Renamed for clarity
const wss = new WebSocketServer({
  server: httpServer, // Attach WebSocket server to the HTTP server
  host: HOST,
  maxPayload: 102400 * 1024, // Example payload limit
});



//
// SESSION
//
const sessionOptions: SessionOptions = {
  resave: true,
  saveUninitialized: true,
  secret: "somesecret",
  cookie: { maxAge: 600000, httpOnly: false },
};

app.use(session(sessionOptions));

//
// SOCKET.IO
//
const io = runSocketIOService(httpServer);

//
// CORS
//
app.use(cors({ origin: "*" }));

//
// MORGAN
//
app.use(morgan("tiny"));

//
// BODY PARSER
//
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.raw());
app.use(bodyParser.text());
app.use(bodyParser.json());

//
// STATIC FILES
//
app.use("/public", express.static(path.join(__dirname, "../public")));
app.use("/css", express.static(path.join(__dirname, "../public/css")));
app.use("/scripts", express.static(path.join(__dirname, "../public/scripts")));

//
// HANDLEBARS
//
const setupExHbs = new SetupHandlebars(app);
setupExHbs.setup();

//
// DATABASE
//
DBCore.getInstance().connect();

//
// HANDLE ROUTE
//
handleRoute(app);

//
// RUN SERVICES
//
// Ffmpeg
ffmpegService.run();
// Websocket
runWebsocketService(wss, HOST, PORT);

//
// ERROR HANDLER
//
app.use(HandleErrorService.middleware);

//
// START SERVER
//
// Use httpServer.listen (which now has both ws and socket.io attached)
httpServer.listen(PORT, HOST, () => {
  console.log(
    `Server (with WebSocket and Socket.IO) is running on http://${HOST}:${PORT}`
  );
});

export { wss, httpServer, HOST, PORT, io }; // Export io and the httpServer
