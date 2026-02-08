import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, UpdateConversationDto } from './dto';
import { MessagesService } from '../messages/messages.module';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let service: ConversationsService;
  let messagesService: MessagesService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const mockMessagesService = {
    listMessages: jest.fn(),
  };

  const mockRequest = {
    user: { id: 'user_123' },
    headers: { 'x-trace-id': 'tr_123' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [
        {
          provide: ConversationsService,
          useValue: mockService,
        },
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
      ],
    }).compile();

    controller = module.get<ConversationsController>(ConversationsController);
    service = module.get<ConversationsService>(ConversationsService);
    messagesService = module.get<MessagesService>(MessagesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应该创建新会话', async () => {
      const createDto: CreateConversationDto = { characterId: 'char_123' };
      const mockResult = {
        conversationId: 'conv_123',
        characterVersionId: 'cv_123',
      };

      mockService.create.mockResolvedValue(mockResult);

      const result = await controller.create(createDto, mockRequest);

      expect(result).toEqual({
        conversationId: 'conv_123',
        characterVersionId: 'cv_123',
        traceId: 'tr_123',
      });
      expect(service.create).toHaveBeenCalledWith('user_123', createDto);
    });
  });

  describe('findAll', () => {
    it('应该返回会话列表', async () => {
      const mockResult = {
        items: [
          {
            conversationId: 'conv_1',
            title: '会话1',
            updatedAt: new Date(),
            lastMessagePreview: '预览1',
            lastMessageAt: null,
          },
          {
            conversationId: 'conv_2',
            title: '会话2',
            updatedAt: new Date(),
            lastMessagePreview: '预览2',
            lastMessageAt: new Date(),
          },
        ],
        nextCursor: 'conv_2',
      };

      mockService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockRequest, undefined, '20');

      expect(result).toEqual({
        items: mockResult.items,
        nextCursor: 'conv_2',
        traceId: 'tr_123',
      });
      expect(service.findAll).toHaveBeenCalledWith('user_123', undefined, 20);
    });

    it('应该限制最大分页大小', async () => {
      mockService.findAll.mockResolvedValue({ items: [], nextCursor: null });

      await controller.findAll(mockRequest, undefined, '150');

      expect(service.findAll).toHaveBeenCalledWith('user_123', undefined, 100);
    });
  });

  describe('findOne', () => {
    it('应该返回会话详情', async () => {
      const conversationId = 'conv_123';
      const mockConversation = {
        id: conversationId,
        characterId: 'char_123',
        characterVersionId: 'cv_123',
        title: '测试会话',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastMessageAt: null,
      };

      mockService.findOne.mockResolvedValue(mockConversation);

      const result = await controller.findOne(conversationId, mockRequest);

      expect(result).toEqual({
        conversationId,
        characterId: 'char_123',
        characterVersionId: 'cv_123',
        title: '测试会话',
        createdAt: mockConversation.createdAt,
        updatedAt: mockConversation.updatedAt,
        lastMessageAt: null,
        traceId: 'tr_123',
      });
      expect(service.findOne).toHaveBeenCalledWith(conversationId, 'user_123');
    });
  });

  describe('update', () => {
    it('应该更新会话标题', async () => {
      const conversationId = 'conv_123';
      const updateDto: UpdateConversationDto = { title: '新标题' };
      const mockResult = {
        conversationId,
        title: '新标题',
      };

      mockService.update.mockResolvedValue(mockResult);

      const result = await controller.update(conversationId, updateDto, mockRequest);

      expect(result).toEqual({
        conversationId,
        title: '新标题',
        traceId: 'tr_123',
      });
      expect(service.update).toHaveBeenCalledWith(
        conversationId,
        'user_123',
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('应该删除会话', async () => {
      const conversationId = 'conv_123';

      mockService.remove.mockResolvedValue(undefined);

      await controller.remove(conversationId, mockRequest);

      expect(service.remove).toHaveBeenCalledWith(conversationId, 'user_123');
    });
  });

  describe('findMessages', () => {
    it('应该返回消息列表', async () => {
      const conversationId = 'conv_123';
      const mockResult = {
        items: [
          {
            id: 'msg_1',
            role: 'user',
            content: '你好',
            status: 'sent',
            partial: false,
            supersededByMessageId: null,
            attachments: [],
            createdAt: new Date().toISOString(),
          },
        ],
        nextCursor: 'cursor_1',
      };
      mockMessagesService.listMessages.mockResolvedValue(mockResult);

      const result = await controller.findMessages(
        conversationId,
        mockRequest,
        undefined,
        '20',
      );

      expect(result).toEqual({
        items: mockResult.items,
        nextCursor: mockResult.nextCursor,
        traceId: 'tr_123',
      });
      expect(messagesService.listMessages).toHaveBeenCalledWith(
        mockRequest,
        conversationId,
        { limit: '20', cursor: undefined },
      );
    });
  });
});
