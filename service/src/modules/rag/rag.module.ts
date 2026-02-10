import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [PrismaModule, LlmModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
