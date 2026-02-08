import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CharacterVersionsController, CharacterVersionsByCharacterController } from './character-versions.controller';
import { CharacterVersionsProvider } from './character-versions.provider';
import { CharacterVersionsRepository } from './character-versions.repository';
import { CharacterVersionsService } from './character-versions.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    CharacterVersionsController,
    CharacterVersionsByCharacterController,
  ],
  providers: [
    CharacterVersionsService,
    CharacterVersionsRepository,
    CharacterVersionsProvider,
  ],
  exports: [
    CharacterVersionsService,
    CharacterVersionsRepository,
    CharacterVersionsProvider,
  ],
})
export class CharacterVersionsModule {}
