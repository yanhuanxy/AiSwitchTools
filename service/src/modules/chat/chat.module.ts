import { Module } from "@nestjs/common";
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

import { RagModule } from '../rag/rag.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { LlmModule } from '../llm/llm.module';

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
    LlmModule
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatRepository, ChatProvider],
  exports: [ChatService, ChatRepository, ChatProvider],
})
export class ChatModule {}
