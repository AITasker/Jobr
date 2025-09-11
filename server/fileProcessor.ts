import mammoth from 'mammoth';
import fs from 'fs';

export interface ProcessedFile {
  text: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export class FileProcessor {
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly SUPPORTED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  static validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: 'File size exceeds 5MB limit'
      };
    }

    if (!this.SUPPORTED_TYPES.includes(file.mimetype)) {
      return {
        valid: false,
        error: 'Unsupported file type. Please upload PDF, DOC, or DOCX files'
      };
    }

    return { valid: true };
  }

  static async extractText(file: Express.Multer.File): Promise<ProcessedFile> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    let text = '';

    try {
      switch (file.mimetype) {
        case 'application/pdf':
          text = await this.extractFromPDF(file.buffer);
          break;
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          text = await this.extractFromDoc(file.buffer);
          break;
        default:
          throw new Error('Unsupported file format');
      }

      if (!text.trim()) {
        throw new Error('No readable text found in the document');
      }

      return {
        text: text.trim(),
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype
      };
    } catch (error) {
      console.error('File processing error:', error);
      throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async extractFromPDF(buffer: Buffer): Promise<string> {
    try {
      // Use dynamic import to avoid pdf-parse initialization issues
      const pdf = (await import('pdf-parse')).default;
      const data = await pdf(buffer);
      return data.text;
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to read PDF file. Please ensure the file is not corrupted or password protected.');
    }
  }

  private static async extractFromDoc(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      
      // Check if extraction was successful but returned empty text
      if (!result.value || result.value.trim().length === 0) {
        throw new Error('Document appears to be empty or contains no readable text. Please ensure it\'s a valid DOC/DOCX file.');
      }
      
      return result.value;
    } catch (error) {
      console.error('Document parsing error:', error);
      
      // Provide more specific error messages for DOC vs DOCX
      if (error instanceof Error) {
        if (error.message.includes('empty') || error.message.includes('readable text')) {
          throw error; // Re-throw our custom empty document error
        }
        
        // Handle potential DOC file compatibility issues
        throw new Error('Failed to read document file. Legacy .doc files may not be fully supported - please convert to .docx format for better compatibility. Ensure the file is not corrupted or password protected.');
      }
      
      throw new Error('Failed to process document file. Please try again with a different file format.');
    }
  }
}