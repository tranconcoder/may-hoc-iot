import WebSocket from "ws";

export type WebSocketCustom = WebSocket & {
    id: string;
    source: string;
};
