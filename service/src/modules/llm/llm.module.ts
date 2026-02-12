import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LlmService } from './llm.service';
import { ModelConfigService } from './model-config.service';
import { ConfigModule } from '@nestjs/config';
import { LlmController } from './llm.controller';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '../../prisma/prisma.module';
import { LocalVectorService } from './local-vector.service';
import { TransformersVectorService } from './transformers-vector.service';

@Global()
@Module({
  imports: [
    HttpModule,
    ConfigModule, 
    AuthModule, 
    PrismaModule,
    CacheModule.register({
      ttl: 300 * 1000, // 300 seconds
      max: 100,
    })
  ],
  controllers: [LlmController],
  providers: [LlmService, ModelConfigService, LocalVectorService, TransformersVectorService],
  exports: [LlmService, ModelConfigService, LocalVectorService],
})
export class LlmModule {}
