import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeBaseService } from './knowledge-base.service';
import { RagService } from '../rag/rag.service';
import { AuthGuard } from '../auth/auth.guard';
import { BadRequestException } from '@nestjs/common';

describe('KnowledgeBaseController', () => {
  let controller: KnowledgeBaseController;
  let kbService: KnowledgeBaseService;
  let ragService: RagService;

  const mockKbService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockRagService = {
    ingestDocument: jest.fn(),
    deleteDocument: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KnowledgeBaseController],
      providers: [
        { provide: KnowledgeBaseService, useValue: mockKbService },
        { provide: RagService, useValue: mockRagService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<KnowledgeBaseController>(KnowledgeBaseController);
    kbService = module.get<KnowledgeBaseService>(KnowledgeBaseService);
    ragService = module.get<RagService>(RagService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadDocument', () => {
    it('should upload document successfully', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;

      const req = { user: { id: 'user-1' } };
      mockKbService.findOne.mockResolvedValue({ id: 'kb-1', ownerUserId: 'user-1' });
      mockRagService.ingestDocument.mockResolvedValue({ id: 'doc-1' });

      const result = await controller.uploadDocument(req as any, 'kb-1', mockFile);

      expect(mockKbService.findOne).toHaveBeenCalledWith('kb-1', 'user-1');
      expect(mockRagService.ingestDocument).toHaveBeenCalledWith('user-1', 'kb-1', {
        buffer: mockFile.buffer,
        originalname: mockFile.originalname,
        mimetype: mockFile.mimetype,
      });
      expect(result).toEqual({ id: 'doc-1' });
    });

    it('should throw BadRequestException if file missing', async () => {
      await expect(controller.uploadDocument({ user: { id: '1' } } as any, 'kb-1', null as any))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user id missing', async () => {
        const mockFile = { buffer: Buffer.from('test') } as any;
        await expect(controller.uploadDocument({ user: {} } as any, 'kb-1', mockFile))
          .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if kb not found', async () => {
        const mockFile = { buffer: Buffer.from('test') } as any;
        const req = { user: { id: 'user-1' } };
        mockKbService.findOne.mockResolvedValue(null);
        await expect(controller.uploadDocument(req as any, 'kb-1', mockFile))
          .rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteDocument', () => {
    it('should delete document successfully', async () => {
      const req = { user: { id: 'user-1' } };
      mockRagService.deleteDocument.mockResolvedValue({ success: true });

      const result = await controller.deleteDocument(req as any, 'kb-1', 'doc-1');

      expect(mockRagService.deleteDocument).toHaveBeenCalledWith('user-1', 'doc-1');
      expect(result).toEqual({ success: true });
    });
  });
});
