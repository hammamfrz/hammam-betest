import Redis from "ioredis";

const redisClient = new Redis({
  host: "localhost",
  port: 6379,
});

redisClient.on("connect", () => {
  console.log("Redis connected");
});

redisClient.on("error", (err) => {
  console.error("Error connecting to redis", err);
});

export default redisClient;
