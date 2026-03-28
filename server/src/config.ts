import path from "path";

export const PORT = Number(process.env.PORT || 4000);
export const API_PREFIX = "/api";
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
