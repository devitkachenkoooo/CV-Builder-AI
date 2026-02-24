import { z } from 'zod';

// File validation schema
export const docxFileSchema = z.object({
  name: z.string(),
  size: z.number().max(5 * 1024 * 1024, "File size must be less than 5MB"), // 5MB limit
  type: z.literal("application/vnd.openxmlformats-officedocument.wordprocessingml.document", {
    errorMap: () => ({ message: "Only .docx files are allowed" })
  }),
  lastModified: z.number()
});

// File validation function
export function validateDocxFile(file: File): {
  isValid: boolean;
  error?: string;
} {
  try {
    const result = docxFileSchema.safeParse({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    if (!result.success) {
      const error = result.error.issues[0];
      return {
        isValid: false,
        error: error?.message || "Invalid file format"
      };
    }

    // Additional check: file extension
    if (!file.name.toLowerCase().endsWith('.docx')) {
      return {
        isValid: false,
        error: "File must have .docx extension"
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: "File validation failed"
    };
  }
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check if file is likely a valid .docx by checking file signature
export async function validateDocxSignature(file: File): Promise<boolean> {
  try {
    // .docx files are ZIP archives with specific structure
    // Read first 4 bytes to check ZIP signature
    const buffer = await file.slice(0, 4).arrayBuffer();
    const view = new Uint8Array(buffer);
    
    // ZIP files start with 0x50 0x4B 0x03 0x04 or 0x50 0x4B 0x05 0x06 or 0x50 0x4B 0x07 0x08
    return view[0] === 0x50 && view[1] === 0x4B; // 'PK'
  } catch {
    return false;
  }
}
