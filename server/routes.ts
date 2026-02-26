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
    console.log("--- 🚀 ДІАГНОСТИКА ГЕНЕРАЦІЇ СТАРТ ---");
    console.log("1. Поточна робоча директорія (cwd):", process.cwd());

    const template = await storage.getTemplate(templateId);
    if (!template) {
      throw new Error("Template not found in DB");
    }

    // Список шляхів, які ми перевіримо
    const pathsToCheck = [
      { name: "КОРІНЬ/templates", path: path.join(process.cwd(), "templates", template.fileName) },
      { name: "CLIENT/PUBLIC/TEMPLATES", path: path.join(process.cwd(), "client", "public", "templates", template.fileName) },
      { name: "SERVER/TEMPLATES", path: path.join(process.cwd(), "server", "templates", template.fileName) }
    ];

    let templateHtml = "";
    let finalPath = "";

    console.log("2. Перевірка наявності файлів:");
    for (const item of pathsToCheck) {
      const exists = fsSync.existsSync(item.path);
      console.log(`   - [${exists ? "✅ ЗНАЙДЕНО" : "❌ НЕМАЄ"}] ${item.name}: ${item.path}`);
      if (exists && !templateHtml) {
        templateHtml = await fs.readFile(item.path, "utf-8");
        finalPath = item.path;
      }
    }

    if (!templateHtml) {
      console.error("3. ❌ КРИТИЧНО: Файл не знайдено в жодному з місць!");
      throw new Error(`ENOENT: No template file found for ${template.fileName}`);
    }

    console.log("4. ✅ Файл успішно зчитано з:", finalPath);

    // Оновлення статусу (з новим текстом для перевірки деплою)
    await storage.updateGeneratedCvStatus(jobId, "processing", lang === 'ua' ? "🚀 ПОЇХАЛИ! ШІ працює..." : "🚀 GO! AI is working...");

    // Далі йде логіка з AI...
    const prompt = `You are a CV expert... Template: ${templateHtml.substring(0, 100)}...`; // Короткий шматок для тесту

    try {
      const response = await openrouter.chat.completions.create({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [{ role: "user", content: `Inject content into this template: ${templateHtml} \n\n Content: ${cvText}` }],
        max_tokens: 8192,
        temperature: 0.7,
      });

      let generatedHtml = response.choices[0]?.message?.content || "";
      generatedHtml = generatedHtml.replace(/```html\n?/g, "").replace(/```\n?$/g, "").trim();

      const outputDir = path.join(process.cwd(), "client", "public", "generated");
      await fs.mkdir(outputDir, { recursive: true });

      const filename = `cv-${jobId}-${Date.now()}.html`;
      const outputPath = path.join(outputDir, filename);
      await fs.writeFile(outputPath, generatedHtml, "utf-8");

      await storage.updateGeneratedCvStatus(jobId, "complete", "✅ Готово!", `/generated/${filename}`);
      console.log("5. 🎉 ГЕНЕРАЦІЯ ЗАВЕРШЕНА УСПІШНО");

    } catch (apiError: any) {
      console.error("❌ Помилка AI:", apiError.message);
      throw apiError;
    }

  } catch (error: any) {
    console.error("❌ КРИТИЧНА ПОМИЛКА:", error.message);
    await storage.updateGeneratedCvStatus(jobId, "failed", `❌ Помилка: ${error.message}`);
  }
}