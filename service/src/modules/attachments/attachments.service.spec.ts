import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AttachmentsService } from './attachments.service';
import { AttachmentsRepository } from './attachments.repository';
import { AttachmentsProvider } from './attachments.provider';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let repository: AttachmentsRepository;
  let provider: AttachmentsProvider;
  let configService: ConfigService;

  const mockRepository = {
    findById: jest.fn(),
    findByIdAndOwner: jest.fn(),
    findByOwner: jest.fn(),
    updateScanStatus: jest.fn(),
    isReferenced: jest.fn(),
    deleteById: jest.fn(),
    findByIds: jest.fn(),
    findByIdsAndOwner: jest.fn(),
    findPendingForScan: jest.fn(),
    exists: jest.fn(),
    getScanStats: jest.fn(),
    cleanupFailedAttachments: jest.fn(),
    create: jest.fn(),
  };

  const mockProvider = {
    generateViewUrl: jest.fn(),
    generateUploadUrl: jest.fn(),
    deleteFile: jest.fn(),
    getFileMetadata: jest.fn(),
    getStorageStats: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const configs: Record<string, any> = {
        'MAX_UPLOADS_PER_USER': 1000,
        'SIGNED_URL_EXPIRY': 3600,
      };
      return configs[key] ?? defaultValue;
    }),
  };

  const mockPrismaService = {
    attachment: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        {
          provide: AttachmentsRepository,
          useValue: mockRepository,
        },
        {
          provide: AttachmentsProvider,
          useValue: mockProvider,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: 'PrismaService',
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
    repository = module.get<AttachmentsRepository>(AttachmentsRepository);
    provider = module.get<AttachmentsProvider>(AttachmentsProvider);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAttachment', () => {
    it('应该成功获取附件信息', async () => {
      const mockAttachment = {
        id: 'att_123',
        ownerUserId: 'user_123',
        storageKey: 'uploads/user_123/att_123.jpg',
        scanStatus: 'passed',
        mime: 'image/jpeg',
        size: 1024,
        createdAt: new Date(),
      };

      repository.findByIdAndOwner.mockResolvedValue(mockAttachment);

      const result = await service.getAttachment('att_123', 'user_123', {
        includeMetadata: true,
      });

      expect(result.attachmentId).toBe('att_123');
      expect(result.scanStatus).toBe('passed');
      expect(typeof result.viewUrl).toBe('string');
      expect(result.viewUrl).toMatch(/^\/api\/attachments\/att_123\/download\?token=[A-Za-z0-9._~-]+/);
      const token = decodeURIComponent(result.viewUrl!.split('token=')[1]);
      expect(service.validateDownloadToken(token, 'user_123', 'att_123')).toBe(true);
      expect(result.mime).toBe('image/jpeg');
      expect(result.size).toBe(1024);
      expect(result.width).toBeUndefined();
      expect(result.height).toBeUndefined();
      expect(result.createdAt).toBe(mockAttachment.createdAt);
    });

    it('当scanStatus不是passed时viewUrl应该为null', async () => {
      const mockAttachment = {
        id: 'att_123',
        ownerUserId: 'user_123',
        storageKey: 'uploads/user_123/att_123.jpg',
        scanStatus: 'pending',
        mime: 'image/jpeg',
        size: 1024,
        createdAt: new Date(),
      };

      repository.findByIdAndOwner.mockResolvedValue(mockAttachment);

      const result = await service.getAttachment('att_123', 'user_123');

      expect(result.viewUrl).toBeNull();
    });

    it('当附件不存在时应该抛出异常', async () => {
      repository.findByIdAndOwner.mockResolvedValue(null);

      await expect(service.getAttachment('att_not_exist', 'user_123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listAttachments', () => {
    it('应该成功获取附件列表', async () => {
      const mockAttachments = {
        items: [
          {
            id: 'att_1',
            ownerUserId: 'user_123',
            storageKey: 'uploads/user_123/att_1.jpg',
            scanStatus: 'passed',
            mime: 'image/jpeg',
            size: 1024,
            createdAt: new Date(),
          },
          {
            id: 'att_2',
            ownerUserId: 'user_123',
            storageKey: 'uploads/user_123/att_2.png',
            scanStatus: 'pending',
            mime: 'image/png',
            size: 2048,
            createdAt: new Date(),
          },
        ],
        nextCursor: 'att_2',
      };

      repository.findByOwner.mockResolvedValue(mockAttachments);

      const result = await service.listAttachments('user_123');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].viewUrl).toMatch(/^\/api\/attachments\/att_1\/download\?token=[A-Za-z0-9._~-]+/); // passed
      const token = decodeURIComponent(result.items[0].viewUrl!.split('token=')[1]);
      expect(service.validateDownloadToken(token, 'user_123', 'att_1')).toBe(true);
      expect(result.items[1].viewUrl).toBeNull(); // pending
      expect(result.nextCursor).toBe('att_2');
    });
  });

  describe('deleteAttachment', () => {
    it('应该成功删除附件', async () => {
      const mockAttachment = {
        id: 'att_123',
        ownerUserId: 'user_123',
        storageKey: 'uploads/user_123/att_123.jpg',
        scanStatus: 'passed',
      };

      repository.findByIdAndOwner.mockResolvedValue(mockAttachment);
      repository.isReferenced.mockResolvedValue(false);

      const result = await service.deleteAttachment('att_123', 'user_123');

      expect(result).toEqual({
        attachmentId: 'att_123',
        deleted: true,
      });
      expect(repository.deleteById).toHaveBeenCalledWith('att_123');
      expect(provider.deleteFile).toHaveBeenCalledWith('uploads/user_123/att_123.jpg');
    });

    it('当附件被引用时应该抛出异常', async () => {
      const mockAttachment = {
        id: 'att_123',
        ownerUserId: 'user_123',
        storageKey: 'uploads/user_123/att_123.jpg',
        scanStatus: 'passed',
      };

      repository.findByIdAndOwner.mockResolvedValue(mockAttachment);
      repository.isReferenced.mockResolvedValue(true);

      await expect(service.deleteAttachment('att_123', 'user_123')).rejects.toThrow(
        ConflictException,
      );
    });

    it('当附件不存在时应该抛出异常', async () => {
      repository.findByIdAndOwner.mockResolvedValue(null);

      await expect(service.deleteAttachment('att_not_exist', 'user_123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('filterAttachmentsForModel', () => {
    it('应该只返回passed状态的附件ID', async () => {
      const attachmentIds = ['att_1', 'att_2', 'att_3'];
      const mockAttachments = [
        { id: 'att_1', scanStatus: 'passed' },
        { id: 'att_2', scanStatus: 'pending' },
        { id: 'att_3', scanStatus: 'rejected' },
      ];

      repository.findByIdsAndOwner.mockResolvedValue(mockAttachments);

      const result = await service.filterAttachmentsForModel(attachmentIds, 'user_123');

      expect(result).toEqual(['att_1']);
    });

    it('当附件列表为空时应该返回空数组', async () => {
      const result = await service.filterAttachmentsForModel([], 'user_123');
      expect(result).toEqual([]);
    });
  });

  describe('updateScanResult', () => {
    it('应该成功更新扫描结果', async () => {
      const mockAttachment = {
        id: 'att_123',
        storageKey: 'uploads/user_123/att_123.jpg',
        scanStatus: 'pending',
      };

      repository.findById.mockResolvedValue(mockAttachment);
      provider.getFileMetadata.mockResolvedValue({ width: 800, height: 600 });
      repository.updateScanStatus.mockResolvedValue({
        ...mockAttachment,
        scanStatus: 'passed',
        width: 800,
        height: 600,
      });

      const result = await service.updateScanResult('att_123', 'passed');

      expect(result.scanStatus).toBe('passed');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('当附件不存在时应该抛出异常', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.updateScanResult('att_not_exist', 'passed')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generateUploadUrl', () => {
    it('应该成功生成上传URL', async () => {
      const mockResult = {
        attachmentId: 'att_new',
        uploadUrl: 'https://s3.example.com/upload-url',
        storageKey: 'uploads/user_123/att_new.jpg',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrismaService.attachment.count.mockResolvedValue(10); // 用户已上传10个
      repository.create.mockResolvedValue({ id: 'att_new' });
      provider.generateUploadUrl.mockResolvedValue({
        url: 'https://s3.example.com/upload-url',
        expiresAt: mockResult.expiresAt,
      });

      // Mock ulid
      jest.mock('ulid', () => ({
        ulid: () => 'ulid_123',
      }));

      const result = await service.generateUploadUrl(
        'user_123',
        'test.jpg',
        'image/jpeg',
        1024 * 1024, // 1MB
      );

      expect(result.attachmentId).toBeDefined();
      expect(result.uploadUrl).toBe('https://s3.example.com/upload-url');
      expect(result.storageKey).toContain('uploads/user_123/');
    });

    it('当用户达到上传限制时应该抛出异常', async () => {
      mockPrismaService.attachment.count.mockResolvedValue(1000); // 达到限制

      await expect(
        service.generateUploadUrl('user_123', 'test.jpg', 'image/jpeg', 1024),
      ).rejects.toThrow(ConflictException);
    });

    it('当文件类型不支持时应该抛出异常', async () => {
      mockPrismaService.attachment.count.mockResolvedValue(10);

      await expect(
        service.generateUploadUrl('user_123', 'test.txt', 'text/plain', 1024),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateOwnership', () => {
    it('应该验证附件所有权', async () => {
      repository.exists.mockResolvedValue(true);

      const result = await service.validateOwnership('att_123', 'user_123');

      expect(result).toBe(true);
      expect(repository.exists).toHaveBeenCalledWith('att_123', 'user_123');
    });

    it('当附件不属于用户时应该返回false', async () => {
      repository.exists.mockResolvedValue(false);

      const result = await service.validateOwnership('att_123', 'user_456');

      expect(result).toBe(false);
    });
  });

  describe('validateOwnershipBatch', () => {
    it('应该批量验证附件所有权', async () => {
      const attachmentIds = ['att_1', 'att_2', 'att_3'];
      const mockAttachments = [
        { id: 'att_1' },
        { id: 'att_2' },
        { id: 'att_3' },
      ];

      repository.findByIdsAndOwner.mockResolvedValue(mockAttachments);

      const result = await service.validateOwnershipBatch(attachmentIds, 'user_123');

      expect(result).toBe(true);
    });

    it('当部分附件不属于用户时应该返回false', async () => {
      const attachmentIds = ['att_1', 'att_2', 'att_3'];
      const mockAttachments = [
        { id: 'att_1' },
        { id: 'att_2' },
        // 缺少 att_3
      ];

      repository.findByIdsAndOwner.mockResolvedValue(mockAttachments);

      const result = await service.validateOwnershipBatch(attachmentIds, 'user_123');

      expect(result).toBe(false);
    });
  });
});
