
import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { ConfigService } from '@nestjs/config';

@Controller('v4')
export class V4ObservabilityController {
  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly configService: ConfigService,
  ) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health() {
    // Basic health check logic
    // In a real scenario, we would check DB connection, Redis, etc.
    // For now, we return a standard UP status.
    const memoryUsage = process.memoryUsage();
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
      services: {
        database: 'UP', // Assumption for now
        workflowEngine: 'UP',
        llmGateway: 'UP',
      },
      resources: {
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        },
        uptime: process.uptime(),
      },
      version: '4.0.0',
    };
  }

  @Get('metrics')
  async metrics() {
    // Return metrics in a format suitable for Prometheus
    return await this.observabilityService.getPrometheusMetrics();
  }

  @Get('debug')
  async debug() {
    const profile = this.configService.get('APP_PROFILE', 'legacy');
    const featureFlags = {
      FEATURE_AGENT_AGGREGATION: this.configService.get('FEATURE_AGENT_AGGREGATION', false),
    };
    return {
      profile,
      featureFlags,
      env: process.env.NODE_ENV,
    };
  }
}
