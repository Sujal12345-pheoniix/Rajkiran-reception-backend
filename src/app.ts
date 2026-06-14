import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import morgan from "morgan";
import { errorHandler } from "./middleware/errorHandler.js";
import rateLimit from "express-rate-limit";

const app = express();

// ─── Security Headers ────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Enable trust proxy for Render load balancers/reverse proxies to let rate limiters read client IPs
app.set("trust proxy", 1);

// ─── CORS — FIXED: was origin:"*" with credentials:true (invalid) ─────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,https://rajkiran-reception-frontend.vercel.app")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ─── Global Rate Limiter (all routes) ────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

app.use(globalLimiter);

// ─── Cookie & Body Parsing ────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "10kb" })); // Prevent large payload attacks
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api", routes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

export default app;
