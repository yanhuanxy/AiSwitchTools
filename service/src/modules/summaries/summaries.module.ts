import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SummariesController } from './summaries.controller';
import { SummariesService } from './summaries.service';
import { SummariesRepository } from './summaries.repository';
import { SummariesProvider } from './summaries.provider';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  controllers: [SummariesController],
  providers: [
    SummariesService,
    SummariesRepository,
    SummariesProvider,
  ],
  exports: [SummariesService, SummariesRepository, SummariesProvider],
})
export class SummariesModule {}
