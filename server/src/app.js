
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import chatRoutes from "./routes/chat.js";

const app = express();

app.set("trust proxy", 1);

// =========================================================
// CORS
// =========================================================

// const defaultOrigins = [
//   "http://localhost:5173",
//   "http://localhost:4173",
// ];

const envOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigins = [
  // ...defaultOrigins,
  ...envOrigins,
]
  .map((origin) => origin.replace(/\/+$/, ""))
  .filter((origin, index, array) => {
    return array.indexOf(origin) === index;
  });

console.log("Allowed CORS origins:", corsOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without Origin
      // (Postman, server-to-server requests, etc.)
      if (!origin) {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/+$/, "");

      if (corsOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }

      console.log("❌ CORS blocked:", origin);

      return callback(new Error("CORS origin not allowed"));
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
    ],
  }),
);

// =========================================================
// SECURITY
// =========================================================

app.use(helmet());

// =========================================================
// BODY PARSER
// =========================================================

app.use(express.json({ limit: "100kb" }));

app.use(express.urlencoded({ extended: true }));

// =========================================================
// RATE LIMIT
// =========================================================

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// =========================================================
// HEALTH / ROOT
// =========================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Scroller API",
    message: "Backend is running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "ok",
  });
});

// =========================================================
// ROUTES
// =========================================================

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api", chatRoutes);

// =========================================================
// 404
// =========================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// =========================================================
// EXPORT
// =========================================================

export default app;
