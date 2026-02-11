import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { DocumentProcessorService } from './document-processor.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [PrismaModule, LlmModule],
  providers: [RagService, DocumentProcessorService],
  exports: [RagService],
})
export class RagModule {}
