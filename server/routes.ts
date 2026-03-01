import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { processUploadedFile } from "./lib/file-processor";
import { validateCVContent, generateUserFriendlyMessage, formatSuggestionsForUser } from "./lib/cv-validator";
import { sanitizeHtml } from "./lib/html-sanitizer";
import multer from "multer";
import OpenAI from "openai";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only .docx files
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are allowed'));
    }
  }
});

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
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Start CV generation
  app.post(api.generate.start.path, isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Handle file upload
      if (!req.file) {
        return res.status(400).json({
          message: "❌ No file uploaded! Please select a .docx file to create your CV.",
          field: "file"
        });
      }

      // Process uploaded file
      const fileResult = await processUploadedFile(req.file);

      if (!fileResult.success) {
        let errorMessage = fileResult.error || "Failed to process file";

        // Add user-friendly messages for common errors
        if (errorMessage.includes("File must have .docx extension")) {
          errorMessage = "❌ Invalid file format! Please upload a .docx file (Microsoft Word).";
        } else if (errorMessage.includes("Invalid MIME type")) {
          errorMessage = "❌ Invalid file type! File must be a Microsoft Word document (.docx).";
        } else if (errorMessage.includes("File too large")) {
          errorMessage = "❌ File too large! Maximum size: 5MB.";
        } else if (errorMessage.includes("Empty file")) {
          errorMessage = "❌ File is empty! Please select a file with content.";
        } else if (errorMessage.includes("Failed to extract text")) {
          errorMessage = "❌ Failed to read file content! Please check that the file is not corrupted.";
        }

        return res.status(400).json({
          message: errorMessage,
          field: "file"
        });
      }

      const cvText = fileResult.text;
      const sourceInfo = `Uploaded file: ${req.file.originalname}`;

      // Parse template ID first
      const templateId = parseInt(req.body.templateId);
      if (isNaN(templateId) || templateId <= 0) {
        return res.status(400).json({
          message: "❌ Invalid template ID! Please select a valid CV template.",
          field: "templateId"
        });
      }

      // 1. Validate CV content using AI FIRST (before creating anything in DB)

      const validationResult = await validateCVContent(cvText);

      if (!validationResult.isValid) {
        const userMessage = generateUserFriendlyMessage(validationResult);
        const suggestions = formatSuggestionsForUser(validationResult.suggestions || []);
        const fullMessage = userMessage + suggestions;


        return res.status(400).json({
          message: fullMessage,
          field: "file",
          validationDetails: {
            isValid: false,
            quality: validationResult.quality,
            issues: validationResult.issues
          }
        });
      }

      const userFriendlyStatus = generateUserFriendlyMessage(validationResult);

      // 2. ONLY NOW create the job in the database
      const cv = await storage.createGeneratedCv({
        userId,
        templateId,
        status: "processing",
        progress: userFriendlyStatus,
      });

      // 3. Start async generation
      generateCvAsync(cv.id, templateId, cvText, sourceInfo).catch(err => {
      });

      res.status(202).json({ jobId: cv.id });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Failed to start generation" });
    }
  });

  // Get generation status
  app.get(api.generate.status.path, isAuthenticated, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId as string);
      if (Number.isNaN(jobId)) {
        return res.status(400).json({ message: "Invalid job id" });
      }
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
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });

  // Get individual CV for viewing
  app.get("/api/resumes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid CV id" });
      }
      const userId = req.user.claims.sub;

      const cv = await storage.getGeneratedCvWithTemplate(id);
      if (!cv) {
        return res.status(404).json({ message: 'CV not found' });
      }
      if (cv.userId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      res.json(cv);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch CV" });
    }
  });

  // Render generated CV HTML from database
  app.get(api.generatedCv.render.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid CV id" });
      }
      const userId = req.user.claims.sub;

      const cv = await storage.getGeneratedCv(id);
      if (!cv) {
        return res.status(404).json({ message: "CV not found" });
      }
      if (cv.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (!cv.htmlContent) {
        return res.status(404).json({ message: "Generated CV HTML not found" });
      }

      res.setHeader("Content-Type", "text/html");
      res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'none'; object-src 'none'; iframe-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:;");
      res.send(cv.htmlContent);
    } catch (error) {
      res.status(500).json({ message: "Failed to render CV" });
    }
  });

  // Delete a resume
  app.delete(api.resumes.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid CV id" });
      }
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
      res.status(500).json({ message: "Failed to delete resume" });
    }
  });

  return httpServer;
}

// === HELPER FUNCTIONS ===

async function seedTemplates() {
  const existing = await storage.getTemplates();

  // Auto-generate templates from files in templates directory
  const templatesDir = path.join(process.cwd(), "client", "public", "templates");
  const templateFiles = fsSync.readdirSync(templatesDir).filter(file => file.endsWith('.html'));
  
  const templates = templateFiles.map((fileName) => {
    const templateNumber = fileName.replace('.html', '');
    const templateId = parseInt(templateNumber.split('-')[1]); // Extract number from template-X

    return {
      id: templateId,
      name: `Template ${templateId}`,
      fileName: fileName, // Use actual filename without hash
      screenshotUrl: `/images/templates/${fileName.replace('.html', '.png')}`,
      description: `Template ${templateId} description`
    };
  });

  // Find templates that need to be added
  const existingFileNames = existing.map(t => t.fileName);
  const templatesToAdd = templates.filter(t => !existingFileNames.includes(t.fileName));
  
  // Find templates that should be removed (not in files anymore)
  const requiredFileNames = templates.map(t => t.fileName);
  const templatesToRemove = existing.filter(t => !requiredFileNames.includes(t.fileName));

  // Add new templates
  for (const template of templatesToAdd) {
    await storage.createTemplate(template);
  }

  // Remove obsolete templates (will also delete related CVs)
  for (const template of templatesToRemove) {
    await storage.deleteTemplate(template.id);
  }
}

function cleanModelHtmlResponse(raw: string): string {
  return raw
    .replace(/```html\s*/gi, "")
    .replace(/```\s*$/g, "")
    .trim();
}

async function generateCvAsync(jobId: number, templateId: number, cvText: string, sourceInfo?: string) {
  try {
    const template = await storage.getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found in DB");
    }

    const templatePath = path.join(process.cwd(), "client", "public", "templates", template.fileName);

    if (!fsSync.existsSync(templatePath)) {
      throw new Error(`Template file ${template.fileName} not found in templates directory`);
    }

    const templateHtml = await fs.readFile(templatePath, "utf-8");
    const normalizedCvText = cvText.replace(/\u0000/g, "").trim();

    await storage.updateGeneratedCvStatus(
      jobId,
      "processing",
      "AI is analyzing and formatting your CV..."
    );

    const model = "meta-llama/llama-3.3-70b-instruct";
    const systemMessage = `You are a deterministic HTML transformation engine. Follow instructions exactly.

Output requirements:
- Return only raw HTML.
- No markdown code fences.
- No explanations.`;

    const generationPrompt = `Inject CV data into the provided HTML template.

Requirements:
- Detect language from CV content and keep output in that same language.
- Preserve template visual style exactly: CSS, classes, typography, spacing, and overall look.
- Adapt structure to CV content:
  - remove template sections that have no matching source data;
  - do not invent sections that are not in source CV.
- Keep data in correct semantic blocks:
  - do not place soft skills/languages into unrelated blocks (for example interests) unless source CV explicitly has such block and data.
- Extract all important data from CV: personal info, experience, education, skills, soft skills, languages, links, tools, grouped skill lists.
- Do not drop grouped items (if source has "Category: a, b, c", keep all items).
- Keep brand and technology names unchanged.
- Remove placeholders and empty content blocks.

Output:
- Return only raw HTML.
- No markdown.
- No explanations.

SOURCE INFO:
${sourceInfo || "N/A"}

HTML TEMPLATE:
${templateHtml}

CV CONTENT:
${normalizedCvText}`;

    try {
      const response = await openrouter.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: generationPrompt },
        ],
        max_tokens: 8192,
        temperature: 0.1,
      });

      let generatedHtml = cleanModelHtmlResponse(response.choices[0]?.message?.content || "");
      if (!generatedHtml) {
        throw new Error("AI returned empty HTML");
      }

      // Sanitize HTML before saving
      generatedHtml = sanitizeHtml(generatedHtml);

      const pdfUrl = buildUrl(api.generatedCv.render.path, { id: jobId });
      await storage.updateGeneratedCvStatus(
        jobId,
        "complete",
        "CV successfully created!",
        pdfUrl,
        generatedHtml
      );
    } catch (apiError: any) {
      console.error("AI Generation Error:", apiError.message);
      await storage.updateGeneratedCvStatus(
        jobId,
        "failed",
        "AI generation failed"
      );
    }
  } catch (error: any) {
    console.error("Critical CV Generation Error:", error.message);
    await storage.updateGeneratedCvStatus(
      jobId,
      "failed",
      "Critical generation error"
    );
  }
}
