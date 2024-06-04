import { config } from "dotenv";

config();

export const protocol = String(process.env.APP_PROTOCOL) || "http";
export const hostname = String(process.env.APP_HOSTNAME) || "127.0.0.1";
export const port = Number(process.env.APP_PORT) || 8080;
export const jwtSecret = String(process.env.JWT_SECRET_KEY) || "secret123";
export const jwtExpired = String(process.env.JWT_EXPIRED) || "1d";
