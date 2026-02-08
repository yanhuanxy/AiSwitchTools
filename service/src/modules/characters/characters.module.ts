import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { MessagesModule } from '../messages/messages.module';
import { AuthModule } from '../auth/auth.module';
import { CharactersController } from './characters.controller';
import { CharactersProvider } from './characters.provider';
import { CharactersRepository } from './characters.repository';
import { CharactersService } from './characters.service';

@Module({
  imports: [PrismaModule, AttachmentsModule, MessagesModule, AuthModule],
  controllers: [CharactersController],
  providers: [CharactersService, CharactersRepository, CharactersProvider],
  exports: [CharactersService, CharactersRepository, CharactersProvider],
})
export class CharactersModule {}
