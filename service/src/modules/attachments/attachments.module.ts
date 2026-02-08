import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentsRepository } from './attachments.repository';
import { AttachmentsProvider } from './attachments.provider';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule, MessagesModule],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    AttachmentsRepository,
    AttachmentsProvider,
  ],
  exports: [AttachmentsService, AttachmentsRepository, AttachmentsProvider],
})
export class AttachmentsModule {}
