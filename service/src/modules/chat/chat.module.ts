import { Module } from "@nestjs/common";
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { SummariesModule } from '../summaries/summaries.module';
import { SafetyModule } from '../safety/safety.module';
import { TasksModule } from '../tasks/tasks.module';
import { ChatController } from './chat.controller';
import { ChatProvider } from './chat.provider';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';
import { LegacyChatProcessor } from './processors/legacy-chat.processor';
import { AggregateChatProcessor } from './processors/aggregate-chat.processor';
import { CHAT_PROCESSOR } from './chat.interfaces';

import { RagModule } from '../rag/rag.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { LlmModule } from '../llm/llm.module';
import { AggregateModule } from '../aggregate/aggregate.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule, 
    AttachmentsModule, 
    SummariesModule, 
    SafetyModule, 
    TasksModule,
    RagModule,
    WorkflowEngineModule,
    LlmModule,
    AggregateModule
  ],
  controllers: [ChatController],
  providers: [
    ChatService, 
    ChatRepository, 
    ChatProvider,
    LegacyChatProcessor,
    AggregateChatProcessor,
    {
      provide: CHAT_PROCESSOR,
      useFactory: (configService: ConfigService, legacy: LegacyChatProcessor, aggregate: AggregateChatProcessor) => {
        const profile = configService.get('APP_PROFILE', 'legacy');
        return profile === 'aggregate' ? aggregate : legacy;
      },
      inject: [ConfigService, LegacyChatProcessor, AggregateChatProcessor]
    }
  ],
  exports: [ChatService, ChatRepository, ChatProvider],
})
export class ChatModule {}
