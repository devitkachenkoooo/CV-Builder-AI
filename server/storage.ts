import { db } from "./db";
import {
  cvTemplates,
  generatedCvs,
  type CvTemplate,
  type InsertCvTemplate,
  type GeneratedCv,
  type InsertGeneratedCv,
  type GeneratedCvResponse,
  type JobStatusResponse,
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Templates
  getTemplates(): Promise<CvTemplate[]>;
  getTemplate(id: number): Promise<CvTemplate | undefined>;
  createTemplate(template: InsertCvTemplate): Promise<CvTemplate>;
  clearTemplates(): Promise<void>;
  
  // Generated CVs
  getGeneratedCv(id: number): Promise<GeneratedCv | undefined>;
  getGeneratedCvWithTemplate(id: number): Promise<GeneratedCvResponse | undefined>;
  getUserGeneratedCvs(userId: string): Promise<GeneratedCvResponse[]>;
  createGeneratedCv(cv: InsertGeneratedCv): Promise<GeneratedCv>;
  updateGeneratedCvStatus(
    id: number,
    status: string,
    progress?: string,
    pdfUrl?: string,
    htmlContent?: string,
    errorMessage?: string
  ): Promise<GeneratedCv>;
  deleteGeneratedCv(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Templates
  async getTemplates(): Promise<CvTemplate[]> {
    return await db.select().from(cvTemplates).orderBy(cvTemplates.id);
  }

  async getTemplate(id: number): Promise<CvTemplate | undefined> {
    const [template] = await db
      .select()
      .from(cvTemplates)
      .where(eq(cvTemplates.id, id));
    return template;
  }

  async createTemplate(template: InsertCvTemplate): Promise<CvTemplate> {
    const [created] = await db
      .insert(cvTemplates)
      .values(template)
      .returning();
    return created;
  }

  async clearTemplates(): Promise<void> {
    await db.delete(cvTemplates);
  }

  // Generated CVs
  async getGeneratedCv(id: number): Promise<GeneratedCv | undefined> {
    const [cv] = await db
      .select()
      .from(generatedCvs)
      .where(eq(generatedCvs.id, id));
    return cv;
  }

  async getGeneratedCvWithTemplate(id: number): Promise<GeneratedCvResponse | undefined> {
    const result = await db
      .select({
        cv: generatedCvs,
        template: cvTemplates,
      })
      .from(generatedCvs)
      .leftJoin(cvTemplates, eq(generatedCvs.templateId, cvTemplates.id))
      .where(eq(generatedCvs.id, id));

    if (!result[0]) return undefined;

    return {
      ...result[0].cv,
      template: result[0].template || undefined,
    };
  }

  async getUserGeneratedCvs(userId: string): Promise<GeneratedCvResponse[]> {
    const results = await db
      .select({
        cv: generatedCvs,
        template: cvTemplates,
      })
      .from(generatedCvs)
      .leftJoin(cvTemplates, eq(generatedCvs.templateId, cvTemplates.id))
      .where(eq(generatedCvs.userId, userId))
      .orderBy(desc(generatedCvs.createdAt));

    return results.map((r) => ({
      ...r.cv,
      template: r.template || undefined,
    }));
  }

  async createGeneratedCv(cv: InsertGeneratedCv): Promise<GeneratedCv> {
    const [created] = await db
      .insert(generatedCvs)
      .values(cv)
      .returning();
    return created;
  }

  async updateGeneratedCvStatus(
    id: number,
    status: string,
    progress?: string,
    pdfUrl?: string,
    htmlContent?: string,
    errorMessage?: string
  ): Promise<GeneratedCv> {
    const [updated] = await db
      .update(generatedCvs)
      .set({
        status,
        progress,
        pdfUrl,
        htmlContent,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(generatedCvs.id, id))
      .returning();
    return updated;
  }

  async deleteGeneratedCv(id: number): Promise<void> {
    await db.delete(generatedCvs).where(eq(generatedCvs.id, id));
  }
}

export const storage = new DatabaseStorage();
