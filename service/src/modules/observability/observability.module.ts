import { Module } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { V4ObservabilityController } from './v4-observability.controller';
import { ObservabilityProvider } from './observability.provider';
import { ObservabilityRepository } from './observability.repository';
import { ObservabilityService } from './observability.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [ObservabilityController, V4ObservabilityController],
  providers: [ObservabilityService, ObservabilityRepository, ObservabilityProvider],
  exports: [ObservabilityService, ObservabilityRepository, ObservabilityProvider],
})
export class ObservabilityModule {}
