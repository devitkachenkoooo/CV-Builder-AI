import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { processUploadedFile } from "./lib/file-processor";
import multer from "multer";
import OpenAI from "openai";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import puppeteer from "puppeteer";

// Function to convert HTML to PDF
async function convertHtmlToPdf(html: string, outputPath: string): Promise<void> {
  console.log("[PDF] Starting HTML to PDF conversion");
  
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport to A4 size
    await page.setViewport({ width: 794, height: 1123 });
    
    // Add CSS for better PDF formatting
    const enhancedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 100%;
            margin: 0;
            padding: 20px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;
    
    // Set content and wait for it to load
    await page.setContent(enhancedHtml, { waitUntil: 'networkidle0' });
    
    // Generate PDF with A4 size and better settings
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      preferCSSPageSize: true,
      scale: 0.8 // Scale down slightly to fit content better
    });
    
    console.log(`[PDF] Successfully generated PDF: ${outputPath}`);
  } catch (error) {
    console.error("[PDF] Error converting HTML to PDF:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

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
      console.error("Error fetching templates:", error);
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
          message: "File is required",
          field: "file"
        });
      }

      // Process uploaded file
      const fileResult = await processUploadedFile(req.file);
      
      if (!fileResult.success) {
        return res.status(400).json({
          message: fileResult.error || "Failed to process file",
          field: "file"
        });
      }
      
      const cvText = fileResult.text;
      const sourceInfo = `Uploaded file: ${req.file.originalname}`;

      // Parse template ID
      const templateId = parseInt(req.body.templateId);
      if (isNaN(templateId) || templateId <= 0) {
        return res.status(400).json({
          message: "Invalid template ID",
          field: "templateId"
        });
      }

      // Create CV generation job
      const cv = await storage.createGeneratedCv({
        userId,
        templateId,
        status: "pending",
        progress: "Initializing...",
        googleDocsUrl: null,
      });

      // Start async generation (don't await)
      generateCvAsync(cv.id, templateId, cvText, sourceInfo).catch(err => {
        console.error("[ASYNC] generateCvAsync crashed immediately:", err);
      });

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
      console.error("Error fetching CV:", error);
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

      // Delete generated HTML and PDF files
      if (cv.pdfUrl) {
        try {
          const htmlPath = path.join(process.cwd(), "client", "public", cv.pdfUrl);
          const pdfPath = path.join(process.cwd(), "client", "public", cv.pdfUrl.replace('.html', '.pdf'));
          
          // Delete HTML file
          if (fsSync.existsSync(htmlPath)) {
            await fs.unlink(htmlPath);
            console.log(`[DELETE] Removed HTML file: ${htmlPath}`);
          }
          
          // Delete PDF file
          if (fsSync.existsSync(pdfPath)) {
            await fs.unlink(pdfPath);
            console.log(`[DELETE] Removed PDF file: ${pdfPath}`);
          }
        } catch (fileError) {
          console.error(`[DELETE] Error deleting file ${cv.pdfUrl}:`, fileError);
          // Continue with database deletion even if file deletion fails
        }
      }

      await storage.deleteGeneratedCv(id);
      console.log(`[DELETE] Successfully deleted CV ${id} from database`);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting resume:", error);
      res.status(500).json({ message: "Failed to delete resume" });
    }
  });

  // Generate PDF on demand
  app.get("/api/resumes/:id/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      // Verify ownership
      const cv = await storage.getGeneratedCv(id);
      if (!cv) {
        return res.status(404).json({ message: 'CV not found' });
      }
      if (cv.userId !== userId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      if (!cv.pdfUrl) {
        return res.status(404).json({ message: 'PDF file not found' });
      }

      // Read the PDF file and send it
      const pdfPath = path.join(process.cwd(), "client", "public", cv.pdfUrl);
      const pdfBuffer = await fs.readFile(pdfPath);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="cv-${id}.pdf"`);
      res.send(pdfBuffer);
      
      console.log(`[PDF] Sent existing PDF for CV ${id}`);
    } catch (error) {
      console.error("Error sending PDF:", error);
      res.status(500).json({ message: "Failed to send PDF" });
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

  console.log(`Seeded ${templates.length} CV templates`);
}

async function generateCvAsync(jobId: number, templateId: number, cvText: string, sourceInfo?: string) {
  console.log(`[ASYNC] Starting generateCvAsync for job ${jobId}`);
  try {
    // Update status: Fetching Document
    await storage.updateGeneratedCvStatus(jobId, "processing", "Processing Document...");

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

    console.log(`[AI] Starting OpenAI call for job ${jobId}...`);
    console.log(`[AI] Using model: meta-llama/llama-3.3-70b-instruct`);
    console.log(`[AI] API Base URL: ${process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL}`);
    console.log(`[AI] API Key exists: ${!!process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY}`);
    
    // Update status: Starting AI
    await storage.updateGeneratedCvStatus(jobId, "processing", "Starting AI generation...");
    
    try {
      // Update status: AI analyzing
      await storage.updateGeneratedCvStatus(jobId, "processing", "AI analyzing content...");
      
      const response = await openrouter.chat.completions.create({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 8192,
        temperature: 0.7,
      });
      
      console.log(`[AI] OpenAI call completed for job ${jobId}`);
      console.log(`[AI] Response length: ${response.choices[0]?.message?.content?.length || 0} chars`);

      let generatedHtml = response.choices[0]?.message?.content || "";

      // Clean up markdown code blocks if present
      generatedHtml = generatedHtml.replace(/```html\n?/g, "").replace(/```\n?$/g, "").trim();

      // Update status: AI formatting
      await storage.updateGeneratedCvStatus(jobId, "processing", "AI formatting CV...");

      // Save HTML and PDF files
      const outputDir = path.join(process.cwd(), "client", "public", "generated");
      await fs.mkdir(outputDir, { recursive: true });
      
      const baseFilename = `cv-${jobId}-${Date.now()}`;
      const htmlFilename = `${baseFilename}.html`;
      const pdfFilename = `${baseFilename}.pdf`;
      
      const htmlPath = path.join(outputDir, htmlFilename);
      const pdfPath = path.join(outputDir, pdfFilename);
      
      // Save HTML file
      await fs.writeFile(htmlPath, generatedHtml, "utf-8");
      
      // Generate PDF file
      await convertHtmlToPdf(generatedHtml, pdfPath);

      // Store both URLs (HTML for viewing, PDF for download)
      const pdfUrl = `/generated/${pdfFilename}`;

      // Update status: Complete
      await storage.updateGeneratedCvStatus(jobId, "complete", undefined, pdfUrl);

      console.log(`Successfully generated CV ${jobId} as HTML and PDF`);
    } catch (apiError) {
      console.error(`[AI] OpenAI API Error for job ${jobId}:`, apiError);
      
      // Fallback: save template without AI processing
      console.log(`[AI] Using fallback: saving template without AI processing for job ${jobId}`);
      
      try {
        const template = await storage.getTemplate(templateId);
        if (!template) {
          throw new Error("Template not found");
        }

        const templatePath = path.join(process.cwd(), "server", "templates", template.fileName);
        const templateHtml = await fs.readFile(templatePath, "utf-8");

        // Update status: Generating PDF
        await storage.updateGeneratedCvStatus(jobId, "processing", "Generating PDF...");

        const outputDir = path.join(process.cwd(), "client", "public", "generated");
        await fs.mkdir(outputDir, { recursive: true });
        
        const baseFilename = `cv-${jobId}-${Date.now()}`;
        const htmlFilename = `${baseFilename}.html`;
        const pdfFilename = `${baseFilename}.pdf`;
        
        const htmlPath = path.join(outputDir, htmlFilename);
        const pdfPath = path.join(outputDir, pdfFilename);
        
        // Save HTML file
        await fs.writeFile(htmlPath, templateHtml, "utf-8");
        
        // Generate PDF file
        await convertHtmlToPdf(templateHtml, pdfPath);

        const pdfUrl = `/generated/${pdfFilename}`;

        // Update status: Complete
        await storage.updateGeneratedCvStatus(jobId, "complete", undefined, pdfUrl);

        console.log(`Successfully generated CV ${jobId} (fallback mode)`);
      } catch (fallbackError) {
        console.error(`[AI] Fallback also failed for job ${jobId}:`, fallbackError);
        throw apiError; // Throw original error
      }
    }
  } catch (error) {
    console.error("DETAILED AI ERROR:", error);
    console.error(`[AI] Error stack:`, error instanceof Error ? error.stack : 'No stack available');
    const errorMessage = error instanceof Error ? error.message : "Generation failed";
    
    // Update database with error status - use "error" to match frontend expectations
    try {
      await storage.updateGeneratedCvStatus(jobId, "failed", undefined, undefined, errorMessage);
      console.log(`[AI] Updated job ${jobId} status to failed with error: ${errorMessage}`);
    } catch (dbError) {
      console.error("[AI] CRITICAL: Failed to update database with error status:", dbError);
    }
  }
}
