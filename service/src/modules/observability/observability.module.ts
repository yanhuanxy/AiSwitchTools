import { Module } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { ObservabilityProvider } from './observability.provider';
import { ObservabilityRepository } from './observability.repository';
import { ObservabilityService } from './observability.service';

@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityService, ObservabilityRepository, ObservabilityProvider],
  exports: [ObservabilityService, ObservabilityRepository, ObservabilityProvider],
})
export class ObservabilityModule {}
