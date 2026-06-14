import rateLimit from "express-rate-limit";

// Stricter limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // relaxed for local testing / high concurrency verification
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again in 15 minutes." },
  skipSuccessfulRequests: true,
});
