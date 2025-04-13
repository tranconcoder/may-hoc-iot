import NodeMediaServer from "node-media-server";
import path from "path";

const chunkTime = 30;

const nmsFfmpeg = new NodeMediaServer({
    rtmp: {
        port: 1935,
        chunk_size: 128 * 1024,
        gop_cache: false,
        ping: 60,
        ping_timeout: 30,
    },
    http: {
        port: 8000,
        mediaroot: "./media",
        allow_origin: "*",
    },
    trans: {
        ffmpeg: path.join(__dirname, "./assets/bin/ffmpeg"),
        tasks: [
            {
                app: "live",
                hls: true,
                hlsFlags: `[hls_time=${chunkTime}:hls_list_size=${
                    24 * 60 * (60 / chunkTime) // 24h
                }:hls_flags=split_by_time]`,
                hlsKeep: true,
                dash: true,
                dashFlags: "[f=dash:window_size=3:extra_window_size=5]",
                dashKeep: true,
            } as any,
        ],
    },
});

nmsFfmpeg.run();
