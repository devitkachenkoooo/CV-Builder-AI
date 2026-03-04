import type { Express } from "express";
import { registerAuthRoutes } from "./auth";
import { registerCvRoutes } from "./cv";
import { registerHealthRoutes } from "./health";
import proxyRouter from "./proxy";
import { seedTemplates } from "../services/cv-service";

export async function registerApiRoutes(app: Express) {
  // Register proxy routes FIRST (before auth for static assets)
  app.use("/proxy", proxyRouter);

  // Setup authentication and auth routes
  await registerAuthRoutes(app);

  // Register health check routes (before auth)
  registerHealthRoutes(app);

  // Seed templates on startup
  await seedTemplates();

  // Register CV-related routes
  registerCvRoutes(app);
}
