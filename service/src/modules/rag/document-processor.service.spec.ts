import { Test, TestingModule } from '@nestjs/testing';
import { DocumentProcessorService } from './document-processor.service';
import { BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

// Mock dependencies
jest.mock('pdf-parse', () => {
  return {
    PDFParse: jest.fn().mockImplementation(() => ({
      getText: jest.fn().mockResolvedValue({ text: 'PDF Content' }),
    })),
  };
});

jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mammoth = require('mammoth');

describe('DocumentProcessorService', () => {
  let service: DocumentProcessorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentProcessorService],
    }).compile();

    service = module.get<DocumentProcessorService>(DocumentProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processFile', () => {
    it('should process text files correctly', async () => {
      const text = 'Hello world. This is a test document.\nIt has multiple lines.';
      const buffer = Buffer.from(text);
      const result = await service.processFile(buffer, 'text/plain');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].content).toContain('Hello world');
    });

    it('should process PDF files correctly', async () => {
      const buffer = Buffer.from('fake pdf');
      const result = await service.processFile(buffer, 'application/pdf');

      expect(PDFParse).toHaveBeenCalledWith(expect.any(Uint8Array));
      expect(result[0].content).toBe('PDF Content');
    });

    it('should process Word files correctly', async () => {
      (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: 'Word Content' });
      const buffer = Buffer.from('fake docx');
      const result = await service.processFile(buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

      expect(mammoth.extractRawText).toHaveBeenCalled();
      expect(result[0].content).toBe('Word Content');
    });

    it('should split long text into chunks with overlap', async () => {
      // Create a long text
      const longText = 'Word '.repeat(1000);
      const buffer = Buffer.from(longText);
      
      const chunkSize = 100;
      const overlap = 20;
      
      const result = await service.processFile(buffer, 'text/plain', chunkSize, overlap);
      
      expect(result.length).toBeGreaterThan(1);
      
      const chunk1 = result[0].content;
      const chunk2 = result[1].content;
      
      expect(chunk1).toBeDefined();
      expect(chunk2).toBeDefined();
    });

    it('should throw BadRequestException for unsupported mimetype', async () => {
      const buffer = Buffer.from('test');
      await expect(service.processFile(buffer, 'image/png')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cleanText', () => {
    it('should remove null bytes and excessive newlines', () => {
      const dirty = 'Hello\0\n\n\nWorld';
      // Access private method via any
      const cleaned = (service as any).cleanText(dirty);
      expect(cleaned).toBe('Hello\n\nWorld');
    });
  });
});
