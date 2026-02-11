import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { ConfigModule } from '@nestjs/config';
import { LlmController } from './llm.controller';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule, 
    AuthModule, 
    PrismaModule,
    CacheModule.register({
      ttl: 300 * 1000, // 300 seconds (in ms if using cache-manager v5, or seconds if v4. Assuming v5 as installed default)
      max: 100,
    })
  ],
  controllers: [LlmController],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
