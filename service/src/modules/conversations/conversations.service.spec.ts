import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from './conversations.service';
import { ConversationsRepository } from './conversations.repository';
import { ConversationsProvider } from './conversations.provider';
import { CreateConversationDto } from './dto';
import { NotFoundException } from '@nestjs/common';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let repository: ConversationsRepository;
  let provider: ConversationsProvider;

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByOwner: jest.fn(),
    updateTitle: jest.fn(),
    softDelete: jest.fn(),
    exists: jest.fn(),
    updateLastMessageAt: jest.fn(),
  };

  const mockProvider = {
    getLatestCharacterVersion: jest.fn(),
    generateConversationTitle: jest.fn(),
    generateConversationId: jest.fn(),
    validateOwnership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: ConversationsRepository,
          useValue: mockRepository,
        },
        {
          provide: ConversationsProvider,
          useValue: mockProvider,
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    repository = module.get<ConversationsRepository>(ConversationsRepository);
    provider = module.get<ConversationsProvider>(ConversationsProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应该成功创建会话', async () => {
      const ownerUserId = 'user_123';
      const createDto: CreateConversationDto = {
        characterId: 'char_456',
      };

      const mockCharacterVersion = { id: 'cv_789', version: 1 };
      const mockCharacter = { id: 'char_456', name: '测试角色' };
      const mockConversation = {
        id: 'conv_123',
        characterVersionId: 'cv_789',
        title: '测试角色 01-28',
      };

      provider.getLatestCharacterVersion.mockResolvedValue(mockCharacterVersion);
      provider.generateConversationTitle.mockReturnValue('测试角色 01-28');
      provider.generateConversationId.mockReturnValue('conv_123');
      repository.create.mockResolvedValue(mockConversation);

      // Mock findCharacterById 方法
      service.findCharacterById = jest.fn().mockResolvedValue(mockCharacter);

      const result = await service.create(ownerUserId, createDto);

      expect(result).toEqual({
        conversationId: 'conv_123',
        characterVersionId: 'cv_789',
      });
      expect(provider.getLatestCharacterVersion).toHaveBeenCalledWith(
        'char_456',
        ownerUserId,
      );
      expect(repository.create).toHaveBeenCalledWith({
        id: 'conv_123',
        ownerUserId,
        characterId: 'char_456',
        characterVersionId: 'cv_789',
        title: '测试角色 01-28',
      });
    });

    it('当角色不存在时应该抛出异常', async () => {
      const ownerUserId = 'user_123';
      const createDto: CreateConversationDto = {
        characterId: 'char_not_found',
      };

      provider.getLatestCharacterVersion.mockRejectedValue(
        new NotFoundException('Character not found'),
      );

      await expect(service.create(ownerUserId, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('应该返回会话列表', async () => {
      const ownerUserId = 'user_123';
      const mockConversations = {
        items: [
          {
            id: 'conv_1',
            characterVersionId: 'cv_1',
            title: '会话1',
            updatedAt: new Date(),
            lastMessageAt: null,
          },
          {
            id: 'conv_2',
            characterVersionId: 'cv_2',
            title: '会话2',
            updatedAt: new Date(),
            lastMessageAt: new Date(),
          },
        ],
        nextCursor: 'conv_2',
      };

      repository.findByOwner.mockResolvedValue(mockConversations);
      service.getLastMessagePreview = jest.fn().mockResolvedValue(undefined);

      const result = await service.findAll(ownerUserId);

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('conv_2');
      expect(repository.findByOwner).toHaveBeenCalledWith(
        ownerUserId,
        undefined,
        20,
      );
    });
  });

  describe('findOne', () => {
    it('应该返回会话详情', async () => {
      const ownerUserId = 'user_123';
      const conversationId = 'conv_123';
      const mockConversation = {
        id: conversationId,
        characterId: 'char_456',
        characterVersionId: 'cv_789',
        title: '测试会话',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: null,
      };

      repository.findById.mockResolvedValue(mockConversation);

      const result = await service.findOne(conversationId, ownerUserId);

      expect(result).toEqual(mockConversation);
      expect(repository.findById).toHaveBeenCalledWith(conversationId, ownerUserId);
    });

    it('当会话不存在时应该抛出异常', async () => {
      const ownerUserId = 'user_123';
      const conversationId = 'conv_not_found';

      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(conversationId, ownerUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('应该成功更新会话标题', async () => {
      const ownerUserId = 'user_123';
      const conversationId = 'conv_123';
      const updateDto = { title: '新标题' };

      repository.exists.mockResolvedValue(true);
      repository.updateTitle.mockResolvedValue({
        id: conversationId,
        title: '新标题',
      });

      const result = await service.update(conversationId, ownerUserId, updateDto);

      expect(result).toEqual({
        conversationId,
        title: '新标题',
      });
      expect(repository.updateTitle).toHaveBeenCalledWith(
        conversationId,
        ownerUserId,
        '新标题',
      );
    });

    it('当会话不存在时应该抛出异常', async () => {
      const ownerUserId = 'user_123';
      const conversationId = 'conv_not_found';
      const updateDto = { title: '新标题' };

      repository.exists.mockResolvedValue(false);

      await expect(
        service.update(conversationId, ownerUserId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('应该成功软删除会话', async () => {
      const ownerUserId = 'user_123';
      const conversationId = 'conv_123';

      repository.exists.mockResolvedValue(true);

      await service.remove(conversationId, ownerUserId);

      expect(repository.softDelete).toHaveBeenCalledWith(conversationId, ownerUserId);
    });

    it('当会话不存在时应该抛出异常', async () => {
      const ownerUserId = 'user_123';
      const conversationId = 'conv_not_found';

      repository.exists.mockResolvedValue(false);

      await expect(service.remove(conversationId, ownerUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateOwnership', () => {
    it('应该验证会话所有权', async () => {
      const ownerUserId = 'user_123';
      const conversationId = 'conv_123';

      provider.validateOwnership.mockResolvedValue(true);

      const result = await service.validateOwnership(conversationId, ownerUserId);

      expect(result).toBe(true);
      expect(provider.validateOwnership).toHaveBeenCalledWith(
        conversationId,
        ownerUserId,
      );
    });
  });
});