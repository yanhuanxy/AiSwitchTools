
import { Test, TestingModule } from '@nestjs/testing';
import { AggregateModule } from './aggregate.module';
import { AggregateService } from './aggregate.service';
import { LlmService } from '../llm/llm.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '../../prisma/prisma.module';
import { ObservabilityModule } from '../observability/observability.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { ObservabilityService } from '../observability/observability.service';
import { SmartIntentService } from './smart-intent.service';
import { Cache } from 'cache-manager';

describe('AggregateModule Integration', () => {
  let moduleRef: TestingModule;
  let aggregateService: AggregateService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        AggregateModule,
        ConfigModule.forRoot({ isGlobal: true }),
      ],
    })
    .overrideProvider(LlmService)
    .useValue({
        chatCompletion: jest.fn(),
        getEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
    })
    .overrideProvider(PrismaService)
    .useValue({
        // Mock prisma methods if needed
    })
    // We override SmartIntentService to avoid file system/DB side effects during test
    .overrideProvider(SmartIntentService)
    .useValue({
        onModuleInit: jest.fn(),
        resolve: jest.fn(),
    })
    // We do NOT override WorkflowEngineService or ObservabilityService 
    // to ensure they are correctly resolved from their respective modules.
    // However, we might need to override their dependencies (like Prisma) which we did above.
    .compile();

    aggregateService = moduleRef.get<AggregateService>(AggregateService);
  });

  it('should verify all dependencies are injected into AggregateService', () => {
    expect(aggregateService).toBeDefined();
    
    // Use 'any' to access private properties for validation
    const service = aggregateService as any;

    expect(service.configService).toBeDefined();
    expect(service.cacheManager).toBeDefined();
    expect(service.workflowEngineService).toBeDefined();
    expect(service.llmService).toBeDefined();
    expect(service.observabilityService).toBeDefined();
    expect(service.smartIntentService).toBeDefined();

    console.log('AggregateService Dependencies Verification:');
    console.log('- ConfigService:', !!service.configService);
    console.log('- CacheManager:', !!service.cacheManager);
    console.log('- WorkflowEngineService:', !!service.workflowEngineService);
    console.log('- LlmService:', !!service.llmService);
    console.log('- ObservabilityService:', !!service.observabilityService);
    console.log('- SmartIntentService:', !!service.smartIntentService);
  });
});
