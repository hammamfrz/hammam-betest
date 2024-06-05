import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.REDIS_URL) {
  throw new Error("Redis URL is not provided");
}

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (error) => {
  console.error("Redis error", error);
});

redisClient.on("connect", () => {
  console.log("Redis connected");
});

(async () => {
  try {
    await redisClient.connect();
    console.log("Redis client connected");
  } catch (error) {
    console.error("Error connecting to Redis", error);
  }
})();

export default redisClient;
