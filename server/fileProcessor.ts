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
    console.log('Starting PDF extraction...');
    
    try {
      // Create the missing test file that pdf-parse is looking for
      const path = await import('path');
      const fs = await import('fs');
      
      // Create test directory if it doesn't exist
      const testDir = './test/data';
      if (!fs.existsSync('./test')) {
        fs.mkdirSync('./test', { recursive: true });
      }
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      
      // Create a minimal dummy PDF file if it doesn't exist
      const testFilePath = './test/data/05-versions-space.pdf';
      if (!fs.existsSync(testFilePath)) {
        // Create a minimal valid PDF content (this is a basic PDF header)
        const minimalPDF = Buffer.from([
          0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, // %PDF-1.4
          0x0A, 0x31, 0x20, 0x30, 0x20, 0x6F, 0x62, 0x6A, // newline, 1 0 obj
          0x0A, 0x3C, 0x3C, 0x2F, 0x54, 0x79, 0x70, 0x65, // <<Type
          0x2F, 0x43, 0x61, 0x74, 0x61, 0x6C, 0x6F, 0x67, // /Catalog
          0x3E, 0x3E, 0x0A, 0x65, 0x6E, 0x64, 0x6F, 0x62, // >> endob
          0x6A, 0x0A, 0x78, 0x72, 0x65, 0x66, 0x0A, 0x30, // j xref 0
          0x20, 0x31, 0x0A, 0x74, 0x72, 0x61, 0x69, 0x6C, // 1 trail
          0x65, 0x72, 0x0A, 0x3C, 0x3C, 0x3E, 0x3E, 0x0A, // er <<>>
          0x25, 0x25, 0x45, 0x4F, 0x46 // %%EOF
        ]);
        fs.writeFileSync(testFilePath, minimalPDF);
        console.log('Created dummy test PDF file for library compatibility');
      }

      // Now try to use pdf-parse
      const pdf = await import('pdf-parse');
      const pdfParser = pdf.default || pdf;
      const data = await pdfParser(buffer);
      
      console.log('PDF extraction successful, extracted text length:', data.text?.length || 0);
      return data.text || '';
      
    } catch (error) {
      console.error('PDF parsing error:', error);
      
      // Provide fallback error message
      throw new Error('Failed to read PDF file. Please try converting your PDF to a DOCX file, or ensure the PDF is not password protected or corrupted.');
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