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

@Module({
  imports: [PrismaModule, AuthModule, AttachmentsModule, SummariesModule, SafetyModule, TasksModule],
  controllers: [ChatController],
  providers: [ChatService, ChatRepository, ChatProvider],
  exports: [ChatService, ChatRepository, ChatProvider],
})
export class ChatModule {}
