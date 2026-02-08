import { Controller, Get, Req, Inject } from '@nestjs/common';
import { Request } from 'express';
import { ObservabilityService } from './observability.service';

@Controller('observability')
export class ObservabilityController {
  constructor(@Inject(ObservabilityService) private readonly observabilityService: ObservabilityService) {}

  @Get('metrics')
  getMetrics(@Req() req: Request) {
    const traceId = this.observabilityService.resolveTraceId(req.headers['x-trace-id']);
    return {
      ...this.observabilityService.getMetricsSnapshot(),
      traceId,
    };
  }
}
