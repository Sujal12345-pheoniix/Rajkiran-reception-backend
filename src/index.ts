import app from "./app.js";
import prisma from "./db/prisma.js";

const PORT = process.env.PORT ?? 3001;
const HOST = process.env.HOST ?? "0.0.0.0";

const server = app.listen(PORT as number, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("\nShutting down...");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
