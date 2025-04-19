import { createClient } from "redis";
import { REDIS_URL } from "../config/redis.config.js";

const client = createClient({
    url: REDIS_URL,
});

client.on("error", (err) => {
    console.error("Redis error", err);
});

client.on("connect", () => {
    console.log("Redis connected");
});

await client.connect();

export default client;
