import mammoth from 'mammoth';
import { docxFileSchema } from '@shared/routes';
import { Request } from 'express';

// Extract text from .docx file using mammoth
export async function extractTextFromDocx(buffer: Buffer): Promise<{
  text: string;
  success: boolean;
  error?: string;
}> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    
    if (result.messages.length > 0) {
      console.warn('Docx processing warnings:', result.messages);
    }
    
    return {
      text: result.value,
      success: true
    };
  } catch (error) {
    console.error('Error extracting text from docx:', error);
    return {
      text: '',
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract text from file'
    };
  }
}

// Define file interface
interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Validate uploaded file
export function validateUploadedFile(file: UploadedFile): {
  isValid: boolean;
  error?: string;
} {
  try {
    const result = docxFileSchema.safeParse({
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      lastModified: Date.now()
    });

    if (!result.success) {
      const error = result.error.issues[0];
      return {
        isValid: false,
        error: error?.message || "Invalid file format"
      };
    }

    // Additional check: file extension
    if (!file.originalname.toLowerCase().endsWith('.docx')) {
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

// Process uploaded file and extract text
export async function processUploadedFile(file: UploadedFile): Promise<{
  text: string;
  success: boolean;
  error?: string;
}> {
  // First validate the file
  const validation = validateUploadedFile(file);
  if (!validation.isValid) {
    return {
      text: '',
      success: false,
      error: validation.error
    };
  }

  // Extract text from the file
  return await extractTextFromDocx(file.buffer);
}
