import { z } from 'zod';
import { 
  insertGeneratedCvSchema,
  CvTemplate,
  GeneratedCv,
  JobStatusResponse,
  GeneratedCvResponse
} from './schema';

// File upload validation schema
export const docxFileSchema = z.object({
  name: z.string().min(1, "File name is required"),
  size: z.number().max(5 * 1024 * 1024, "File size must be less than 5MB"), // 5MB limit
  type: z.string().refine((type) => type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document", {
    message: "Only .docx files are allowed"
  }),
  lastModified: z.number()
}).passthrough(); // Allow additional File properties

// Re-export types for convenience
export type { CvTemplate, GeneratedCvResponse };

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
    code: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  templates: {
    list: {
      method: 'GET' as const,
      path: '/api/templates' as const,
      responses: {
        200: z.array(z.custom<CvTemplate>()),
      },
    },
  },
  generate: {
    start: {
      method: 'POST' as const,
      path: '/api/generate' as const,
      input: z.object({
        templateId: z.number().int().positive("Template ID must be a positive integer"),
        file: docxFileSchema,
      }),
      responses: {
        202: z.object({ jobId: z.number() }),
        400: errorSchemas.validation,
        429: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    status: {
      method: 'GET' as const,
      path: '/api/generate/:jobId' as const,
      responses: {
        200: z.custom<JobStatusResponse>(),
        403: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },
  resumes: {
    list: {
      method: 'GET' as const,
      path: '/api/my-resumes' as const,
      responses: {
        200: z.array(z.custom<GeneratedCvResponse>()),
        401: errorSchemas.unauthorized,
      },
    },
    aiEdit: {
      method: 'POST' as const,
      path: '/api/resumes/:id/ai-edit' as const,
      input: z.object({
        prompt: z.string(),
        useOriginalDocumentContext: z.boolean().optional(),
      }),
      responses: {
        202: z.object({ jobId: z.number() }),
        400: errorSchemas.validation,
        429: errorSchemas.validation,
        403: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
        409: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/resumes/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },
  generatedCv: {
    render: {
      method: 'GET' as const,
      path: '/api/generated-cv/:id/render' as const,
      responses: {
        200: z.string(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },
};

// ============================================
// REQUIRED: buildUrl helper
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// ============================================
// TYPE HELPERS
// ============================================
export type GenerateCvInput = z.infer<typeof api.generate.start.input>;
export type GenerateCvResponse = z.infer<typeof api.generate.start.responses[202]>;
export type TemplatesListResponse = z.infer<typeof api.templates.list.responses[200]>;
export type ResumesListResponse = z.infer<typeof api.resumes.list.responses[200]>;
export type ValidationError = z.infer<typeof errorSchemas.validation>;
export type NotFoundError = z.infer<typeof errorSchemas.notFound>;
export type UnauthorizedError = z.infer<typeof errorSchemas.unauthorized>;
