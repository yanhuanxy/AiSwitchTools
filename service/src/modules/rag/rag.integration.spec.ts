
import { Test, TestingModule } from '@nestjs/testing';
import { RagService } from './rag.service';
import { DocumentProcessorService } from './document-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

// Mock VectorDB
jest.mock('vectordb', () => ({
  connect: jest.fn().mockResolvedValue({
    tableNames: jest.fn().mockResolvedValue([]),
    createTable: jest.fn(),
    openTable: jest.fn().mockResolvedValue({
      add: jest.fn(),
    }),
  }),
}));

// Mock Prisma
const mockPrisma = {
  document: { create: jest.fn(), update: jest.fn() },
  chunk: { create: jest.fn() },
};

// Mock LLM
const mockLlm = {
  getEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
};

describe('RagService Integration (PDF Ingestion)', () => {
  let ragService: RagService;
  let documentProcessor: DocumentProcessorService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        DocumentProcessorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LlmService, useValue: mockLlm },
      ],
    }).compile();

    ragService = module.get<RagService>(RagService);
    documentProcessor = module.get<DocumentProcessorService>(DocumentProcessorService);

    // Initialize module (create table etc)
    await ragService.onModuleInit();
  });

  it('should ingest a PDF file without "pdf is not a function" error', async () => {
    // We use a dummy buffer. It might fail with "Invalid PDF" but should NOT fail with "pdf is not a function".
    
    const buffer = Buffer.from('dummy pdf content');
    const file = {
      buffer,
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
    };

    mockPrisma.document.create.mockResolvedValue({ id: 'doc-1' });
    mockPrisma.document.update.mockResolvedValue({ id: 'doc-1' });

    try {
      await ragService.ingestDocument('user-1', 'kb-1', file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log('Caught expected error:', message);
      
      expect(message).not.toContain('pdf is not a function');
      expect(message).not.toContain('PrismaService is null');
    }
  }, 30000); // Increase timeout to 30s for retries
});
