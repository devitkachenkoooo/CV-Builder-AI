import { z } from "zod";

/**
 * Validates data with Zod schema and logs errors if validation fails
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param label - Label for logging purposes
 * @returns Validated data
 * @throws ZodError if validation fails
 */
export function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}
