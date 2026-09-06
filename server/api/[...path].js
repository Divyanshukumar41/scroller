import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";

let dbPromise;

export default async function handler(req, res) {
  try {
    if (!dbPromise) {
      dbPromise = connectDB();
    }
    await dbPromise;

    return app(req, res);
  } catch (error) {
    console.error("Vercel handler error:", error);
    return res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
}
