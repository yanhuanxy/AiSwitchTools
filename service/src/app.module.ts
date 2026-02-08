import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CharactersModule } from "./modules/characters/characters.module";
import { CharacterVersionsModule } from "./modules/character-versions/character-versions.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { AttachmentsModule } from "./modules/attachments/attachments.module";
import { ChatModule } from "./modules/chat/chat.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { SummariesModule } from "./modules/summaries/summaries.module";
import { SafetyModule } from "./modules/safety/safety.module";
import { ObservabilityModule } from "./modules/observability/observability.module";
import { LlmModule } from "./modules/llm/llm.module";
import { WorkflowModule } from "./modules/workflow/workflow.module";
import { KnowledgeBaseModule } from "./modules/knowledge-base/knowledge-base.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    LlmModule,
    AuthModule,
    CharactersModule,
    CharacterVersionsModule,
    ConversationsModule,
    MessagesModule,
    UploadsModule,
    AttachmentsModule,
    ChatModule,
    TasksModule,
    SummariesModule,
    SafetyModule,
    ObservabilityModule,
    WorkflowModule,
    KnowledgeBaseModule
  ]
})
export class AppModule {}
