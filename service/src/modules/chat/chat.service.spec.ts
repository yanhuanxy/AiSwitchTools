import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { AttachmentsService } from '../attachments/attachments.service';
import { LlmService } from '../llm/llm.service';
import { ChatProvider } from './chat.provider';
import { SummariesService } from '../summaries/summaries.service';
import { SafetyService } from '../safety/safety.service';
import { TasksRepository } from '../tasks/tasks.repository';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { RagService } from '../rag/rag.service';

describe('ChatService Image Handling', () => {
  let service: ChatService;
  let chatRepository: any;
  let attachmentsService: any;
  let llmService: any;

  beforeEach(async () => {
    chatRepository = {
      findConversationContext: jest.fn(),
      findRecentMessages: jest.fn(),
      findTaskWithConversation: jest.fn(),
      updateTaskStatus: jest.fn(),
      updateMessageContent: jest.fn(),
      updateMessageStatus: jest.fn(),
    };
    attachmentsService = {
      getAttachmentFileBuffer: jest.fn(),
    };
    llmService = {
      chatStream: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: ChatRepository, useValue: chatRepository },
        { provide: AttachmentsService, useValue: attachmentsService },
        { provide: LlmService, useValue: llmService },
        { provide: ChatProvider, useValue: { getSystemPrompt: () => 'sys', parsePromptConfig: () => null } },
        { provide: SummariesService, useValue: { getSummary: () => null } },
        { provide: SafetyService, useValue: {} },
        { provide: TasksRepository, useValue: chatRepository }, // Mocking task repo same as chat for simplicity
        { provide: WorkflowEngineService, useValue: {} },
        { provide: RagService, useValue: { retrieve: () => [] } },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should construct multimodal message for image attachment', async () => {
    // Setup
    const taskId = 'task-1';
    const ownerUserId = 'user-1';
    const attachmentId = 'att-1';
    
    chatRepository.findTaskWithConversation.mockResolvedValue({
      conversationId: 'conv-1',
      assistantMessageId: 'msg-2',
      model: 'gpt-4-vision',
    });
    
    chatRepository.findConversationContext.mockResolvedValue({
      characterVersion: { promptConfigJson: '{}' }
    });

    chatRepository.findRecentMessages.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'user',
        content: 'Look at this image',
        attachments: [
          {
            attachment: {
              id: attachmentId,
              mime: 'image/jpeg',
            }
          }
        ]
      }
    ]);

    attachmentsService.getAttachmentFileBuffer.mockResolvedValue({
      buffer: Buffer.from('fake-image-data'),
      mime: 'image/jpeg'
    });

    llmService.chatStream.mockImplementation(async function* () {
      yield { content: 'I see the image' };
    });

    // Execute
    // Access private method for testing via any cast
    await (service as any).processTask(taskId, ownerUserId);

    // Verify
    expect(attachmentsService.getAttachmentFileBuffer).toHaveBeenCalledWith(attachmentId, ownerUserId);
    
    const callArgs = llmService.chatStream.mock.calls[0];
    const messages = callArgs[0];
    const userMsg = messages.find((m: any) => m.role === 'user');
    
    expect(Array.isArray(userMsg.content)).toBe(true);
    expect(userMsg.content).toHaveLength(2);
    expect(userMsg.content[0]).toEqual({ type: 'text', text: 'Look at this image' });
    expect(userMsg.content[1]).toEqual({
      type: 'image_url',
      image_url: {
        url: 'data:image/jpeg;base64,ZmFrZS1pbWFnZS1kYXRh' // base64 of 'fake-image-data'
      }
    });
  });
});
