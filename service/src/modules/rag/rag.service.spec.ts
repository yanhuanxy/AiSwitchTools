import { Test, TestingModule } from '@nestjs/testing';
import { RagService } from './rag.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { DocumentProcessorService } from './document-processor.service';

describe('RagService', () => {
  let service: RagService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        {
          provide: PrismaService,
          useValue: {
            document: { create: jest.fn() },
            chunk: { create: jest.fn() },
          },
        },
        { provide: LlmService, useValue: { getEmbedding: jest.fn() } },
        { provide: DocumentProcessorService, useValue: { processFile: jest.fn() } },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ingestDocument', () => {
    it('should throw error if PrismaService is not initialized (simulated by null document prop)', async () => {
      // Simulate missing document model
      // We need to cast to any to modify the mock behavior dynamically
      Object.defineProperty(prismaService, 'document', { get: () => undefined });

      await expect(service.ingestDocument(
        'user-1',
        'kb-1',
        { buffer: Buffer.from('test'), originalname: 'test.pdf', mimetype: 'application/pdf' }
      )).rejects.toThrow('Database connection failed');
    });
  });
});
