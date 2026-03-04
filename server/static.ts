import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Отримуємо __dirname для CommonJS
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function serveStatic(app: Express) {
  // Для Replit використовуємо dist/public (два рівні вгорід від server/)
  const distPath = path.resolve(__dirname, "..", "..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
