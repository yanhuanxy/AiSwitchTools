import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ConversationsRepository } from './conversations.repository';
import { ConversationsProvider } from './conversations.provider';
import { PrismaModule } from '../../prisma/prisma.module';
import { MessagesModule } from '../messages/messages.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, MessagesModule, AuthModule],
  controllers: [ConversationsController],
  providers: [
    ConversationsService,
    ConversationsRepository,
    ConversationsProvider,
  ],
  exports: [ConversationsService, ConversationsRepository, ConversationsProvider],
})
export class ConversationsModule {}
