
import { Test, TestingModule } from '@nestjs/testing';
import { AggregateChatProcessor } from './aggregate-chat.processor';
import { TasksRepository } from '../../tasks/tasks.repository';
import { ChatRepository } from '../chat.repository';
import { AggregateService } from '../../aggregate/aggregate.service';

describe('AggregateChatProcessor', () => {
  let processor: AggregateChatProcessor;
  let tasksRepository: any;
  let chatRepository: any;
  let aggregateService: any;

  beforeEach(async () => {
    tasksRepository = {
      findTaskWithConversation: jest.fn(),
      updateTaskStatus: jest.fn(),
      updateMessageContent: jest.fn(),
      updateMessageStatus: jest.fn(),
    };
    chatRepository = {
      findConversationContext: jest.fn(),
      findRecentMessages: jest.fn(),
    };
    aggregateService = {
      process: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregateChatProcessor,
        { provide: TasksRepository, useValue: tasksRepository },
        { provide: ChatRepository, useValue: chatRepository },
        { provide: AggregateService, useValue: aggregateService },
      ],
    }).compile();

    processor = module.get<AggregateChatProcessor>(AggregateChatProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should process task successfully', async () => {
    const taskId = 'task-1';
    const ownerUserId = 'user-1';
    const conversationId = 'conv-1';
    const assistantMessageId = 'msg-2';

    tasksRepository.findTaskWithConversation.mockResolvedValue({
      taskId,
      conversationId,
      assistantMessageId,
    });
    chatRepository.findConversationContext.mockResolvedValue({ id: conversationId });
    chatRepository.findRecentMessages.mockResolvedValue([{ role: 'user', content: 'hello' }]);
    aggregateService.process.mockResolvedValue({ content: 'response' });

    await processor.process(taskId, ownerUserId);

    expect(aggregateService.process).toHaveBeenCalled();
    expect(tasksRepository.updateMessageContent).toHaveBeenCalledWith(assistantMessageId, 'response');
    expect(tasksRepository.updateTaskStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('should fail instantiation if TasksRepository is missing', async () => {
    await expect(
      Test.createTestingModule({
        providers: [
          AggregateChatProcessor,
          { provide: TasksRepository, useValue: undefined },
          { provide: ChatRepository, useValue: chatRepository },
          { provide: AggregateService, useValue: aggregateService },
        ],
      }).compile()
    ).rejects.toThrow();
  });

  it('should fail instantiation if ChatRepository is missing', async () => {
    await expect(
        Test.createTestingModule({
          providers: [
            AggregateChatProcessor,
            { provide: TasksRepository, useValue: tasksRepository },
            { provide: ChatRepository, useValue: undefined },
            { provide: AggregateService, useValue: aggregateService },
          ],
        }).compile()
      ).rejects.toThrow();
  });

  it('should fail instantiation if AggregateService is missing', async () => {
    await expect(
        Test.createTestingModule({
          providers: [
            AggregateChatProcessor,
            { provide: TasksRepository, useValue: tasksRepository },
            { provide: ChatRepository, useValue: chatRepository },
            { provide: AggregateService, useValue: undefined },
          ],
        }).compile()
      ).rejects.toThrow();
  });
});
