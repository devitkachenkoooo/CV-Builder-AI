import { pgTable, text, serial, integer, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Re-export auth models
export * from "./models/auth";

// CV Templates table
export const cvTemplates = pgTable("cv_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(), // e.g., "template-1.html"
  screenshotUrl: text("screenshot_url").notNull(), // e.g., "/images/templates/template-1.png"
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Generated CVs table
export const generatedCvs = pgTable("generated_cvs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateId: integer("template_id").notNull().references(() => cvTemplates.id),
  status: text("status").notNull().default("pending"), // pending, processing, complete, failed
  progress: text("progress"), // Current step: "Processing DOCX...", "AI Formatting...", "Generating PDF..."
  pdfUrl: text("pdf_url"), // URL to generated PDF
  htmlContent: text("html_content"), // Generated HTML content stored in DB
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Import users table from auth for reference
import { users } from "./models/auth";

// === BASE SCHEMAS ===
export const insertCvTemplateSchema = createInsertSchema(cvTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertGeneratedCvSchema = createInsertSchema(generatedCvs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type CvTemplate = typeof cvTemplates.$inferSelect;
export type InsertCvTemplate = z.infer<typeof insertCvTemplateSchema>;

export type GeneratedCv = typeof generatedCvs.$inferSelect;
export type InsertGeneratedCv = z.infer<typeof insertGeneratedCvSchema>;

// Request types
export interface GenerateCvRequest {
  templateId: number;
}

// Response types
export type CvTemplateResponse = CvTemplate;
export type CvTemplatesListResponse = CvTemplate[];

export interface GeneratedCvResponse extends GeneratedCv {
  template?: CvTemplate;
}

export type GeneratedCvsListResponse = GeneratedCvResponse[];

// Job status response for polling
export interface JobStatusResponse {
  id: number;
  status: "pending" | "processing" | "complete" | "failed";
  progress?: string;
  pdfUrl?: string;
  htmlContent?: string;
  errorMessage?: string;
  template?: CvTemplate;
}
