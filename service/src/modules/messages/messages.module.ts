import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MessagesController } from './messages.controller';
import { MessagesProvider } from './messages.provider';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository, MessagesProvider],
  exports: [MessagesService, MessagesRepository, MessagesProvider],
})
export class MessagesModule {}
