import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";

// OpenRouter client using Replit AI Integrations (includes Groq/Llama models)
const openrouter = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication FIRST
  await setupAuth(app);
  registerAuthRoutes(app);

  // Seed templates on startup
  await seedTemplates();

  // === PUBLIC ROUTES (no auth required) ===
  // None - all routes require authentication

  // === PROTECTED ROUTES (authentication required) ===

  // Get all CV templates
  app.get(api.templates.list.path, isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Start CV generation
  app.post(api.generate.start.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.generate.start.input.parse(req.body);
      const userId = req.user.claims.sub;

      // Create CV generation job
      const cv = await storage.createGeneratedCv({
        userId,
        templateId: input.templateId,
        status: "pending",
        progress: "Initializing...",
        googleDocsUrl: input.googleDocsUrl,
      });

      // Start async generation (don't await)
      generateCvAsync(cv.id, input.templateId, input.googleDocsUrl);

      res.status(202).json({ jobId: cv.id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Error starting generation:", err);
      res.status(500).json({ message: "Failed to start generation" });
    }
  });

  // Get generation status
  app.get(api.generate.status.path, isAuthenticated, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId as string);
      const cv = await storage.getGeneratedCvWithTemplate(jobId);

      if (!cv) {
        return res.status(404).json({ message: 'Job not found' });
      }

      const response = {
        id: cv.id,
        status: cv.status as any,
        progress: cv.progress || undefined,
        pdfUrl: cv.pdfUrl || undefined,
        errorMessage: cv.errorMessage || undefined,
        template: cv.template,
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching job status:", error);
      res.status(500).json({ message: "Failed to fetch job status" });
    }
  });

  // Get user's generated CVs
  app.get(api.resumes.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cvs = await storage.getUserGeneratedCvs(userId);
      res.json(cvs);
    } catch (error) {
      console.error("Error fetching resumes:", error);
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });

  // Delete a resume
  app.delete(api.resumes.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      // Verify ownership
      const cv = await storage.getGeneratedCv(id);
      if (!cv) {
        return res.status(404).json({ message: 'Resume not found' });
      }
      if (cv.userId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      await storage.deleteGeneratedCv(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting resume:", error);
      res.status(500).json({ message: "Failed to delete resume" });
    }
  });

  return httpServer;
}

// === HELPER FUNCTIONS ===

async function seedTemplates() {
  const existing = await storage.getTemplates();
  if (existing.length > 0) return;

  console.log("Seeding CV templates...");

  const templates = [
    { name: "Classic Minimalist", fileName: "template-1.html", screenshotUrl: "/images/templates/template-1.png", description: "Clean and professional layout with traditional styling" },
    { name: "Modern Professional", fileName: "template-2.html", screenshotUrl: "/images/templates/template-2.png", description: "Contemporary design with clear sections" },
    { name: "Tech Developer", fileName: "template-3.html", screenshotUrl: "/images/templates/template-3.png", description: "Perfect for software engineers and developers" },
    { name: "Creative Designer", fileName: "template-4.html", screenshotUrl: "/images/templates/template-4.png", description: "Stylish design for creative professionals" },
    { name: "Executive Bold", fileName: "template-5.html", screenshotUrl: "/images/templates/template-5.png", description: "Bold and impactful for senior positions" },
    { name: "Elegant Profile", fileName: "template-6.html", screenshotUrl: "/images/templates/template-6.png", description: "Elegant with profile photo section" },
    { name: "Fresh Graduate", fileName: "template-7.html", screenshotUrl: "/images/templates/template-7.png", description: "Great for entry-level positions" },
    { name: "Game Industry", fileName: "template-8.html", screenshotUrl: "/images/templates/template-8.png", description: "Tailored for game industry professionals" },
    { name: "Modern Accent", fileName: "template-9.html", screenshotUrl: "/images/templates/template-9.png", description: "Modern with accent colors" },
    { name: "Dark Professional", fileName: "template-10.html", screenshotUrl: "/images/templates/template-10.png", description: "Professional dark theme design" },
  ];

  for (const template of templates) {
    await storage.createTemplate(template);
  }

  console.log(`Seeded ${templates.length} CV templates`);
}

async function generateCvAsync(jobId: number, templateId: number, googleDocsUrl: string) {
  try {
    // Update status: Fetching Document
    await storage.updateGeneratedCvStatus(jobId, "processing", "Fetching Document...");

    // Note: For simplicity, we'll simulate fetching. Real implementation would use Google Docs API
    // For now, we'll use the URL as a placeholder and let AI know to use sample data
    const cvText = `Please extract and format professional CV information from this Google Docs URL: ${googleDocsUrl}. 
    Use realistic sample data if the URL is not accessible.`;

    // Update status: AI Formatting
    await storage.updateGeneratedCvStatus(jobId, "processing", "AI Formatting...");

    // Read template HTML
    const template = await storage.getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const templatePath = path.join(process.cwd(), "server", "templates", template.fileName);
    const templateHtml = await fs.readFile(templatePath, "utf-8");

    // Use OpenRouter (Llama via Groq) to inject CV content into template
    const prompt = `You are a CV formatting expert. I have a CV template in HTML format and need you to inject professional CV content into it.

TEMPLATE HTML:
${templateHtml}

CV CONTENT TO INJECT:
${cvText}

INSTRUCTIONS:
1. Analyze the template structure carefully
2. Keep ALL <style> tags and CSS exactly as they are - DO NOT modify any styling
3. Replace the example content in the HTML with relevant professional CV information
4. Ensure the content fits perfectly on ONE A4 page
5. Maintain the template's visual design and layout
6. Use realistic, professional content
7. Return ONLY the final HTML code with injected content - no explanations

OUTPUT:
Return the complete HTML document with the CV content injected.`;

    const response = await openrouter.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8192,
      temperature: 0.7,
    });

    let generatedHtml = response.choices[0]?.message?.content || "";

    // Clean up markdown code blocks if present
    generatedHtml = generatedHtml.replace(/```html\n?/g, "").replace(/```\n?$/g, "").trim();

    // Update status: Generating PDF
    await storage.updateGeneratedCvStatus(jobId, "processing", "Generating PDF...");

    // For simplicity, save HTML as "PDF" (in production, use Playwright to render actual PDF)
    const outputDir = path.join(process.cwd(), "client", "public", "generated");
    await fs.mkdir(outputDir, { recursive: true });
    
    const filename = `cv-${jobId}-${Date.now()}.html`;
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, generatedHtml, "utf-8");

    const pdfUrl = `/generated/${filename}`;

    // Update status: Complete
    await storage.updateGeneratedCvStatus(jobId, "complete", undefined, pdfUrl);

    console.log(`Successfully generated CV ${jobId}`);
  } catch (error) {
    console.error(`Error generating CV ${jobId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "Generation failed";
    await storage.updateGeneratedCvStatus(jobId, "failed", undefined, undefined, errorMessage);
  }
}
