import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
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
      const lang = (req.headers['x-language'] as 'ua' | 'en') || 'ua';

      // Handle file upload
      if (!req.file) {
        return res.status(400).json({
          message: lang === 'ua'
            ? "❌ Файл не завантажено! Будь ласка, виберіть файл .docx для створення CV."
            : "❌ No file uploaded! Please select a .docx file to create your CV.",
          field: "file"
        });
      }

      // Process uploaded file
      const fileResult = await processUploadedFile(req.file);

      if (!fileResult.success) {
        let errorMessage = fileResult.error || "Failed to process file";

        // Add user-friendly messages for common errors
        if (lang === 'ua') {
          if (errorMessage.includes("File must have .docx extension")) {
            errorMessage = "❌ Невірний формат файлу! Будь ласка, завантажте файл у форматі .docx (Microsoft Word).";
          } else if (errorMessage.includes("Invalid MIME type")) {
            errorMessage = "❌ Невірний тип файлу! Файл повинен бути документом Microsoft Word (.docx).";
          } else if (errorMessage.includes("File too large")) {
            errorMessage = "❌ Файл занадто великий! Максимальний розмір: 5MB.";
          } else if (errorMessage.includes("Empty file")) {
            errorMessage = "❌ Файл порожній! Будь ласка, виберіть файл з вмістом.";
          } else if (errorMessage.includes("Failed to extract text")) {
            errorMessage = "❌ Не вдалося прочитати вміст файлу! Перевірте, що файл не пошкоджений.";
          }
        } else {
          // English error messages
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
          message: lang === 'ua'
            ? "❌ Невірний ID шаблону! Будь ласка, виберіть правильний шаблон CV."
            : "❌ Invalid template ID! Please select a valid CV template.",
          field: "templateId"
        });
      }

      // 1. Validate CV content using AI FIRST (before creating anything in DB)

      const validationResult = await validateCVContent(cvText, lang);

      if (!validationResult.isValid) {
        const userMessage = generateUserFriendlyMessage(validationResult, lang);
        const suggestions = formatSuggestionsForUser(validationResult.suggestions || [], lang);
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

      const userFriendlyStatus = generateUserFriendlyMessage(validationResult, lang);

      // 2. ONLY NOW create the job in the database
      const cv = await storage.createGeneratedCv({
        userId,
        templateId,
        status: "processing",
        progress: userFriendlyStatus,
      });

      // 3. Start async generation
      generateCvAsync(cv.id, templateId, cvText, lang, sourceInfo).catch(err => {
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

      // Delete generated HTML file
      if (cv.pdfUrl) {
        try {
          const htmlPath = path.join(process.cwd(), "client", "public", cv.pdfUrl);

          // Delete HTML file
          if (fsSync.existsSync(htmlPath)) {
            await fs.unlink(htmlPath);
          }
        } catch (fileError) {
          // Continue with database deletion even if file deletion fails
        }
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
    { name: "Fresh Graduate", fileName: "template-7_1771944300655.html", screenshotUrl: "/images/templates/template-7.png", description: "Great for entry-level positions" },
    { name: "Game Industry", fileName: "template-8_1771944300656.html", screenshotUrl: "/images/templates/template-8.png", description: "Tailored for game industry professionals" },
    { name: "Modern Accent", fileName: "template-9_1771944300656.html", screenshotUrl: "/images/templates/template-9.png", description: "Modern with accent colors" },
    { name: "Dark Professional", fileName: "template-10_1771944300656.html", screenshotUrl: "/images/templates/template-10.png", description: "Professional dark theme design" },
  ];

  for (const template of templates) {
    await storage.createTemplate(template);
  }

}

async function generateCvAsync(jobId: number, templateId: number, cvText: string, lang: 'ua' | 'en' = 'ua', sourceInfo?: string) {
  try {
    try {
      const root = process.cwd();
      console.log("🔍 DIAGNOSTIC START");
      const rootFiles = await fs.readdir(root);
      console.log("1. Root content:", rootFiles);

      if (rootFiles.includes('server')) {
        const serverFiles = await fs.readdir(path.join(root, 'server'));
        console.log("2. Server content:", serverFiles);
        if (serverFiles.includes('templates')) {
          const templates = await fs.readdir(path.join(root, 'server', 'templates'));
          console.log("3. Templates content:", templates);
        }
      }
      console.log("🔍 DIAGNOSTIC END");
    } catch (diagError) {
      console.error("❌ Diagnostic failed:", diagError);
    }
    // Read template HTML
    const template = await storage.getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const templatePath = path.join(process.cwd(), "server", "templates", template.fileName);
    const templateHtml = await fs.readFile(templatePath, "utf-8");

    // Use OpenRouter (Llama via Groq) to inject CV content into template
    const prompt = `You are a CV formatting expert. I have a CV template in HTML format and need you to inject professional CV content into it.

IMPORTANT: The output language must be ${lang === 'ua' ? 'Ukrainian' : 'English'}. Translate all professional terms, skills, experience, and content accordingly, but keep the core professional meaning.

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
6. Use realistic, professional content in ${lang === 'ua' ? 'Ukrainian' : 'English'}
7. Return ONLY the final HTML code with injected content - no explanations

OUTPUT:
Return the complete HTML document with the CV content injected.`;


    // Update status: Starting AI
    await storage.updateGeneratedCvStatus(jobId, "processing", lang === 'ua' ? "Запуск генерації ШІ..." : "Starting AI generation...");

    try {
      // Update status: AI analyzing
      await storage.updateGeneratedCvStatus(jobId, "processing", lang === 'ua' ? "ШІ аналізує вміст..." : "AI analyzing content...");

      const response = await openrouter.chat.completions.create({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 8192,
        temperature: 0.7,
      });


      let generatedHtml = response.choices[0]?.message?.content || "";

      // Clean up markdown code blocks if present
      generatedHtml = generatedHtml.replace(/```html\n?/g, "").replace(/```\n?$/g, "").trim();

      // Update status: AI formatting
      await storage.updateGeneratedCvStatus(jobId, "processing", lang === 'ua' ? "ШІ форматує резюме..." : "AI formatting CV...");

      // Save HTML file only
      const outputDir = path.join(process.cwd(), "client", "public", "generated");
      await fs.mkdir(outputDir, { recursive: true });

      const filename = `cv-${jobId}-${Date.now()}.html`;
      const outputPath = path.join(outputDir, filename);

      // Save HTML file
      await fs.writeFile(outputPath, generatedHtml, "utf-8");

      // Store HTML URL
      const pdfUrl = `/generated/${filename}`;

      // Update status: Complete
      await storage.updateGeneratedCvStatus(jobId, "complete", lang === 'ua' ? "✅ Резюме успішно створено! Готово до перегляду." : "✅ CV successfully created! Ready to view.", pdfUrl);

    } catch (apiError) {

      // Fallback: save template without AI processing

      try {
        const template = await storage.getTemplate(templateId);
        if (!template) {
          throw new Error("Template not found");
        }

        const templatePath = path.join(process.cwd(), "server", "templates", template.fileName);
        const templateHtml = await fs.readFile(templatePath, "utf-8");

        // Update status: Generating HTML
        await storage.updateGeneratedCvStatus(jobId, "processing", lang === 'ua' ? "Генерація HTML..." : "Generating HTML...");

        const outputDir = path.join(process.cwd(), "client", "public", "generated");
        await fs.mkdir(outputDir, { recursive: true });

        const filename = `cv-${jobId}-${Date.now()}.html`;
        const outputPath = path.join(outputDir, filename);

        // Save HTML file
        await fs.writeFile(outputPath, templateHtml, "utf-8");

        const pdfUrl = `/generated/${filename}`;

        // Update status: Complete
        await storage.updateGeneratedCvStatus(jobId, "complete", lang === 'ua' ? "⚠️ Резюме створено в базовому режимі (AI недоступний)." : "⚠️ CV created in fallback mode (AI unavailable).", pdfUrl);

      } catch (fallbackError) {
        await storage.updateGeneratedCvStatus(jobId, "failed", lang === 'ua' ? "❌ Помилка: Не вдалося створити резюме." : "❌ Error: Failed to create CV.");
      }
    }
  } catch (error) {
    await storage.updateGeneratedCvStatus(jobId, "failed", lang === 'ua' ? "❌ Критична помилка." : "❌ Critical error.");
  }
}
