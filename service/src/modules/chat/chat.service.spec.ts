
import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { AttachmentsService } from '../attachments/attachments.service';
import { LlmService } from '../llm/llm.service';
import { ChatProvider } from './chat.provider';
import { SummariesService } from '../summaries/summaries.service';
import { SafetyService } from '../safety/safety.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { CHAT_PROCESSOR, IChatProcessor } from './chat.interfaces';
import { AggregateChatProcessor } from './processors/aggregate-chat.processor';

describe('ChatService', () => {
  let service: ChatService;
  let chatRepository: any;
  let chatProcessor: any;
  let aggregateChatProcessor: any;

  beforeEach(async () => {
    chatRepository = {
      findConversationContext: jest.fn(),
      findIdempotencyRecord: jest.fn(),
      createChatTask: jest.fn(),
      createIdempotencyRecord: jest.fn(),
    };

    chatProcessor = {
      process: jest.fn().mockResolvedValue(undefined),
    };

    aggregateChatProcessor = {
      process: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: ChatRepository, useValue: chatRepository },
        { provide: AttachmentsService, useValue: { validateOwnershipBatch: jest.fn().mockResolvedValue(true), filterAttachmentsForModel: jest.fn() } },
        { provide: LlmService, useValue: {} },
        { provide: ChatProvider, useValue: { 
            getSystemPrompt: () => 'sys', 
            parsePromptConfig: () => null,
            buildIdempotencyKey: () => 'key',
            hashPayload: () => 'hash',
            generateMessageId: () => 'msg-id',
            generateTaskId: () => 'task-id',
            getDefaultModel: () => 'model',
            getIdempotencyTtlMs: () => 1000
        } },
        { provide: SummariesService, useValue: { getSummary: () => null, generateSummary: jest.fn() } },
        { provide: SafetyService, useValue: { checkRateLimit: () => ({ allowed: true }) } },
        { provide: TasksRepository, useValue: {} },
        { provide: CHAT_PROCESSOR, useValue: chatProcessor },
        { provide: AggregateChatProcessor, useValue: aggregateChatProcessor },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTask', () => {
    it('should call chatProcessor.process', async () => {
      const dto = {
        conversationId: 'conv-1',
        clientMessageId: 'client-1',
        content: 'Hello',
      };
      const ownerUserId = 'user-1';

      chatRepository.findConversationContext.mockResolvedValue({ id: 'conv-1' });

      await service.createTask(ownerUserId, dto);

      // Wait for async process to be called (it's called without await in service)
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(chatProcessor.process).toHaveBeenCalled();
    });
  });

  describe('createTaskV2', () => {
    it('should call aggregateChatProcessor.process', async () => {
      const dto = {
        conversationId: 'conv-1',
        clientMessageId: 'client-1',
        content: 'Hello',
      };
      const ownerUserId = 'user-1';

      chatRepository.findConversationContext.mockResolvedValue({ id: 'conv-1' });

      await service.createTaskV2(ownerUserId, dto);

      // Wait for async process to be called
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(aggregateChatProcessor.process).toHaveBeenCalled();
    });

    it('should throw error if aggregateChatProcessor is undefined', async () => {
       // Re-create service with undefined aggregateChatProcessor to simulate the error condition
       const module: TestingModule = await Test.createTestingModule({
        providers: [
          ChatService,
          { provide: ChatRepository, useValue: chatRepository },
          { provide: AttachmentsService, useValue: { validateOwnershipBatch: jest.fn().mockResolvedValue(true), filterAttachmentsForModel: jest.fn() } },
          { provide: LlmService, useValue: {} },
          { provide: ChatProvider, useValue: { 
              getSystemPrompt: () => 'sys', 
              parsePromptConfig: () => null,
              buildIdempotencyKey: () => 'key',
              hashPayload: () => 'hash',
              generateMessageId: () => 'msg-id',
              generateTaskId: () => 'task-id',
              getDefaultModel: () => 'model',
              getIdempotencyTtlMs: () => 1000
          } },
          { provide: SummariesService, useValue: { getSummary: () => null, generateSummary: jest.fn() } },
          { provide: SafetyService, useValue: { checkRateLimit: () => ({ allowed: true }) } },
          { provide: TasksRepository, useValue: {} },
          { provide: CHAT_PROCESSOR, useValue: chatProcessor },
          // Explicitly not providing AggregateChatProcessor, or providing null?
          // NestJS requires providers to be defined. If we want to simulate undefined injection, we can use useValue: undefined (but Nest throws).
          // We can use a factory that returns undefined?
          { provide: AggregateChatProcessor, useFactory: () => undefined },
        ],
      }).compile();

      const brokenService = module.get<ChatService>(ChatService);
      
      const dto = {
        conversationId: 'conv-1',
        clientMessageId: 'client-1',
        content: 'Hello',
      };
      const ownerUserId = 'user-1';
      chatRepository.findConversationContext.mockResolvedValue({ id: 'conv-1' });

      // The error is thrown INSIDE the async processor callback, which is caught by .catch() in handleCreateTask
      // console.error is called. We should spy on console.error.
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await brokenService.createTaskV2(ownerUserId, dto);
      
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        'Background task error', 
        expect.objectContaining({ message: 'AggregateChatProcessor is not initialized' })
      );
      
      consoleSpy.mockRestore();
    });
  });
});
