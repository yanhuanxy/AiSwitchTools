import { Module } from '@nestjs/common';
import { AggregateService } from './aggregate.service';
import { SmartIntentService } from './smart-intent.service';
import { ConfigModule } from '@nestjs/config';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { LlmModule } from '../llm/llm.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ObservabilityModule } from '../observability/observability.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule, 
    WorkflowEngineModule, 
    LlmModule,
    ObservabilityModule,
    PrismaModule,
    CacheModule.register({
      ttl: 5 * 60 * 1000, // 5 minutes
      max: 100, // maximum number of items in cache
    })
  ],
  providers: [AggregateService, SmartIntentService],
  exports: [AggregateService],
})
export class AggregateModule {}
