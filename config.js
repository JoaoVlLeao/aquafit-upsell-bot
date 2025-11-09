// config.js
import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  PORT: Number(process.env.PORT || 8080),
  HEADLESS: String(process.env.HEADLESS || "true").toLowerCase() === "true",
  SESSION_NAME: process.env.SESSION_NAME || "upsell-bot",
  IMAGE_URL:
    process.env.IMAGE_URL ||
    "https://udged.s3.sa-east-1.amazonaws.com/72117/ea89b4b8-12d7-4b80-8ded-0a43018915d4.png",
  LOCAL_IMAGE_NAME: process.env.LOCAL_IMAGE_NAME || "oferta.png",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-pro",
};
