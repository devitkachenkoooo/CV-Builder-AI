import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { processUploadedFile } from "./lib/file-processor";
import { validateCVContent, generateUserFriendlyMessage, formatSuggestionsForUser } from "./lib/cv-validator";
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
  if (existing.length > 0) return;


  const templates = [
    { name: "Classic Minimalist", fileName: "template-1_1771944300652.html", screenshotUrl: "/images/templates/template-1.png", description: "Clean and professional layout with traditional styling" },
    { name: "Modern Professional", fileName: "template-2_1771944300653.html", screenshotUrl: "/images/templates/template-2.png", description: "Contemporary design with clear sections" },
    { name: "Tech Developer", fileName: "template-3_1771944300653.html", screenshotUrl: "/images/templates/template-3.png", description: "Perfect for software engineers and developers" },
    { name: "Creative Designer", fileName: "template-4_1771944300654.html", screenshotUrl: "/images/templates/template-4.png", description: "Stylish design for creative professionals" },
    { name: "Executive Bold", fileName: "template-5_1771944300654.html", screenshotUrl: "/images/templates/template-5.png", description: "Bold and impactful for senior positions" },
    { name: "Elegant Profile", fileName: "template-6_1771944300655.html", screenshotUrl: "/images/templates/template-6.png", description: "Elegant with profile photo section" },
    { name: "Game Industry", fileName: "template-8_1771944300656.html", screenshotUrl: "/images/templates/template-8.png", description: "Tailored for game industry professionals" },
    { name: "Modern Accent", fileName: "template-9_1771944300656.html", screenshotUrl: "/images/templates/template-9.png", description: "Modern with accent colors" },
    { name: "Dark Professional", fileName: "template-10_1771944300656.html", screenshotUrl: "/images/templates/template-10.png", description: "Professional dark theme design" },
  ];

  for (const template of templates) {
    await storage.createTemplate(template);
  }

}

async function generateCvAsync(jobId: number, templateId: number, cvText: string, sourceInfo?: string) {
  try {
    const template = await storage.getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found in DB");
    }

    // Очищаємо назву файлу від можливих timestamp (template-1_123.html -> template-1.html)
    const cleanFileName = template.fileName.split('_')[0].replace('.html', '') + '.html';

    // Визначаємо шлях до шаблону (пріоритет на public папку)
    const templatePath = path.join(process.cwd(), "client", "public", "templates", cleanFileName);

    if (!fsSync.existsSync(templatePath)) {
      throw new Error(`Template file ${cleanFileName} not found in templates directory`);
    }

    const templateHtml = await fs.readFile(templatePath, "utf-8");

    // Оновлюємо статус для користувача
    await storage.updateGeneratedCvStatus(
      jobId, 
      "processing", 
      "AI is analyzing and formatting your CV..."
    );

    const cvHasCyrillic = /[\u0400-\u04FF]/.test(cvText);
    const systemMessage = `You are a deterministic HTML transformation engine. Follow instructions exactly.\n\nLANGUAGE RULE (highest priority):\n- The output language MUST match the language of the CV CONTENT, not the template.\n- If CV CONTENT is Latin-only (no Cyrillic), output MUST NOT contain any Cyrillic characters.\n\nReturn ONLY raw HTML.`;

    const prompt = `You are an HTML injection specialist. Inject the CV content into the HTML template.

    ⚠️ STEP 1 — DETECT LANGUAGE FIRST:
    Read the CV CONTENT below and identify its language (e.g. English, Ukrainian, German, etc.).
    All output text MUST be in this detected language. This is non-negotiable.

    ⚠️ STEP 2 — INJECT AND TRANSLATE:
    - Replace every piece of text in the template with the corresponding CV data.
    - Translate ALL static template labels and section headers (e.g. "Досвід" → "Experience" if CV is in English).
    - Preserve ONLY HTML tags, CSS classes, and attributes — never preserve Ukrainian or any other language text from the template.

    ⚠️ STEP 3 — CLEAN UP:
    - Remove any section, field, or list item that has no matching data in the CV content.
    - Do not leave empty tags, placeholder text, or untranslated headers.

    🔒 HTML TEMPLATE (structure only — ignore its language):
    ${templateHtml}

    📝 CV CONTENT (your language source of truth):
    ${cvText}

    Return ONLY raw HTML. No markdown. No explanation.`;

    try {
      const response = await openrouter.chat.completions.create({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt },
        ],
        max_tokens: 8192,
        temperature: 0.1, // Зменшено для більш детермінованого результату
      });

      let generatedHtml = response.choices[0]?.message?.content || "";
      // Очищаємо від Markdown тегів, якщо ШІ їх додав
      generatedHtml = generatedHtml.replace(/```html\n?/g, "").replace(/```\n?$/g, "").trim();
      if (!generatedHtml) {
        throw new Error("AI returned empty HTML");
      }

      const outputHasCyrillic = /[\u0400-\u04FF]/.test(generatedHtml);
      if (!cvHasCyrillic && outputHasCyrillic) {
        const retryPrompt = `${prompt}\n\nCRITICAL OVERRIDE:\n- The CV CONTENT is in English (Latin alphabet).\n- Your output MUST be 100% English and MUST NOT contain any Cyrillic characters.\n- Translate all headings/labels to English.\n- If you are unsure about a translation, use a common English CV heading.\n\nReturn ONLY raw HTML.`;

        const retryResponse = await openrouter.chat.completions.create({
          model: "meta-llama/llama-3.3-70b-instruct",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: retryPrompt },
          ],
          max_tokens: 8192,
          temperature: 0.2,
        });

        let retryHtml = retryResponse.choices[0]?.message?.content || "";
        retryHtml = retryHtml.replace(/```html\n?/g, "").replace(/```\n?$/g, "").trim();
        if (retryHtml) {
          generatedHtml = retryHtml;
        }
      }

      // Перевіряємо, чи AI зберіг pdf-flow-break класи
      const pdfFlowBreakCount = (generatedHtml.match(/pdf-flow-break/g) || []).length;
      
      if (pdfFlowBreakCount === 0) {
        // Тут можна додати логіку для виправлення або повторної генерації
      }

      const pdfUrl = buildUrl(api.generatedCv.render.path, { id: jobId });
      await storage.updateGeneratedCvStatus(
        jobId, 
        "complete", 
        "✅ CV successfully created!", 
        pdfUrl,
        generatedHtml
      );

    } catch (apiError: any) {
      console.error("AI Generation Error:", apiError.message);
      await storage.updateGeneratedCvStatus(
        jobId, 
        "failed", 
        "❌ AI generation failed"
      );
    }

  } catch (error: any) {
    console.error("Critical CV Generation Error:", error.message);
    await storage.updateGeneratedCvStatus(
      jobId, 
      "failed", 
      "❌ Critical generation error"
    );
  }
}
