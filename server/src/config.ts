import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

export const config = {
  port: Number(process.env.PORT || 8787),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || "data/uploads"),
  templatesDir: path.resolve(root, "templates/print"),
  ocrProvider: process.env.OCR_PROVIDER || "mock",
  ocrApiKey: process.env.OCR_API_KEY || "",
  ocrApiEndpoint: process.env.OCR_API_ENDPOINT || "",
  familyPin: process.env.FAMILY_PIN || "1234",
  root,
};
