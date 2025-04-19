import { createClient } from "redis";
import { REDIS_URL } from "../config/redis.config.js";

/* -------------------------------------------------------------------------- */
/*                            Handle connect redis                            */
/* -------------------------------------------------------------------------- */
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


/* -------------------------------------------------------------------------- */
/*                                  Services                                  */
/* -------------------------------------------------------------------------- */
export const addTrafficLightDetect = async () => {
}


export default client;
