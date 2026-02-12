
import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { IChatProcessor } from '../chat.interfaces';
import { TasksRepository } from '../../tasks/tasks.repository';
import { ChatRepository } from '../chat.repository';
import { ChatProvider } from '../chat.provider';
import { AttachmentsService } from '../../attachments/attachments.service';
import { SummariesService } from '../../summaries/summaries.service';
import { LlmService, ChatMessage } from '../../llm/llm.service';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { RagService } from '../../rag/rag.service';

type PromptConfig = {
  backgroundStory?: string;
  personalityTags?: string[];
  speakingStyle?: string;
  fewShotExamples?: Array<{ user: string; assistant: string }>;
  tabooAndBoundaries?: string;
};

@Injectable()
export class LegacyChatProcessor implements IChatProcessor {
  constructor(
    @Inject(TasksRepository) private readonly tasksRepository: TasksRepository,
    @Inject(ChatRepository) private readonly chatRepository: ChatRepository,
    @Inject(ChatProvider) private readonly chatProvider: ChatProvider,
    @Inject(AttachmentsService) private readonly attachmentsService: AttachmentsService,
    @Inject(SummariesService) private readonly summariesService: SummariesService,
    @Inject(LlmService) private readonly llmService: LlmService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly ragService: RagService,
  ) {}

  async process(taskId: string, ownerUserId: string): Promise<void> {
    try {
      const task = await this.tasksRepository.findTaskWithConversation(taskId, ownerUserId);
      if (!task) return;

      const conversation = await this.chatRepository.findConversationContext({
        id: task.conversationId,
        ownerUserId,
      });
      if (!conversation) {
        await this.tasksRepository.updateTaskStatus({
          taskId,
          status: 'failed',
          errorMessage: 'Conversation not found',
        });
        return;
      }

      const recentMessages = await this.chatRepository.findRecentMessages({
        conversationId: task.conversationId,
        ownerUserId,
        limit: 50,
      });

      // 1. Check for Workflow Binding
      if (conversation.characterVersion.workflowId) {
        try {
          await this.tasksRepository.updateTaskStatus({ taskId, status: 'running' });
          const userMessage = recentMessages.find((m) => m.role === 'user');
          const input = userMessage?.content || '';

          const output = await this.workflowEngine.executeWorkflow(
            conversation.characterVersion.workflowId,
            {
              userId: ownerUserId,
              conversationId: task.conversationId,
              input,
              history: recentMessages,
            }
          );

          await this.tasksRepository.updateMessageContent(task.assistantMessageId, output);
          await this.tasksRepository.updateMessageStatus({
            messageId: task.assistantMessageId,
            status: 'completed',
            partial: false,
          });
          await this.tasksRepository.updateTaskStatus({
            taskId,
            status: 'completed',
            tokenUsageCompletion: 0, 
            tokenUsageTotal: 0,
          });
          return;
        } catch (error) {
           console.error('Workflow execution failed', error);
           throw error;
        }
      }

      const summaryContent = await this.getSummaryContent(task.conversationId, ownerUserId);
      const messagesForLlm: ChatMessage[] = [];
      const systemPrompt = this.chatProvider.getSystemPrompt();
      if (systemPrompt) {
        messagesForLlm.push({ role: 'system', content: systemPrompt });
      }

      // 2. Check for Knowledge Base Binding (RAG)
      if (conversation.characterVersion.knowledgeBaseId) {
        const userMessage = recentMessages.find((m) => m.role === 'user');
        const query = userMessage?.content || '';
        const ragContext = await this.ragService.retrieve(conversation.characterVersion.knowledgeBaseId, query);
        if (ragContext.length > 0) {
          messagesForLlm.push({ 
            role: 'system', 
            content: `Relevant Context from Knowledge Base:\n${ragContext.join('\n---\n')}` 
          });
        }
      }

      const config = this.parsePromptConfig(conversation.characterVersion.promptConfigJson);
      if (config) {
        if (config.backgroundStory) {
          messagesForLlm.push({ role: 'system', content: config.backgroundStory });
        }
        if (config.personalityTags?.length) {
          messagesForLlm.push({
            role: 'system',
            content: `Personality tags: ${config.personalityTags.join(', ')}`,
          });
        }
        if (config.speakingStyle) {
          messagesForLlm.push({ role: 'system', content: config.speakingStyle });
        }
        if (config.tabooAndBoundaries) {
          messagesForLlm.push({ role: 'system', content: config.tabooAndBoundaries });
        }
        if (config.fewShotExamples?.length) {
          for (const example of config.fewShotExamples) {
            if (example.user) messagesForLlm.push({ role: 'user', content: example.user });
            if (example.assistant) messagesForLlm.push({ role: 'assistant', content: example.assistant });
          }
        }
      }

      if (summaryContent) {
        messagesForLlm.push({ role: 'system', content: summaryContent });
      }

      const history = recentMessages
        .filter((m) => m.id !== task.assistantMessageId)
        .reverse();

      for (const msg of history) {
        let content: any = msg.content;
        
        // Handle Attachments
         if (msg.attachments?.length) {
            const parts: any[] = [{ type: 'text', text: msg.content }];
            let hasImage = false;
            
            for (const attachmentRecord of msg.attachments) {
              const attachment = attachmentRecord.attachment;
              // Check if image
              if (attachment.mime.startsWith('image/')) {
                  try {
                      const { buffer } = await this.attachmentsService.getAttachmentFileBuffer(attachment.id, ownerUserId);
                      const base64 = buffer.toString('base64');
                      parts.push({
                          type: 'image_url',
                          image_url: {
                              url: `data:${attachment.mime};base64,${base64}`
                          }
                      });
                      hasImage = true;
                  } catch (e) {
                      console.error(`Failed to load attachment ${attachment.id}`, e);
                      parts[0].text += `\n[Failed to load attachment: ${attachment.id}]`;
                  }
              } else {
                  // Non-image attachments
                  parts[0].text += `\n[attachment: ${attachment.id} (${attachment.mime})]`;
              }
           }
           
           if (hasImage) {
               content = parts;
           } else {
               content = parts[0].text; // Fallback to string if only text appended
           }
        }
        
        messagesForLlm.push({
          role: msg.role as 'user' | 'assistant',
          content,
        });
      }

      await this.tasksRepository.updateTaskStatus({ taskId, status: 'running' });

      const stream = await this.llmService.chatStream(messagesForLlm, {
        model: task.model,
      });

      let fullContent = '';
      let buffer = '';
      let lastUpdate = Date.now();

      for await (const chunk of stream) {
        const content = chunk.content || '';
        if (content) {
          fullContent += content;
          buffer += content;

          if (Date.now() - lastUpdate > 200 || buffer.length > 20) {
            await this.tasksRepository.updateMessageContent(
              task.assistantMessageId,
              fullContent,
            );
            buffer = '';
            lastUpdate = Date.now();
          }
        }
      }

      await this.tasksRepository.updateMessageContent(task.assistantMessageId, fullContent);
      await this.tasksRepository.updateMessageStatus({
        messageId: task.assistantMessageId,
        status: 'completed',
        partial: false,
      });
      await this.tasksRepository.updateTaskStatus({
        taskId,
        status: 'completed',
        tokenUsageCompletion: Math.ceil(fullContent.length / 3),
        tokenUsageTotal: 0, 
      });

    } catch (error) {
      console.error('Task processing failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.tasksRepository.updateTaskStatus({
        taskId,
        status: 'failed',
        errorMessage,
      });
      const task = await this.tasksRepository.findTaskWithConversation(taskId, ownerUserId);
      if (task) {
        await this.tasksRepository.updateMessageStatus({
          messageId: task.assistantMessageId,
          status: 'failed',
          partial: true,
        });
      }
    }
  }

  private async getSummaryContent(conversationId: string, ownerUserId: string) {
    try {
      const summary = await this.summariesService.getSummary(conversationId, ownerUserId);
      return summary.content;
    } catch {
      return null;
    }
  }

  private parsePromptConfig(raw: string): PromptConfig | null {
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PromptConfig;
    } catch {
      return null;
    }
  }
}
