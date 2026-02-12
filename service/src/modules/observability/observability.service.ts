import { Injectable, Logger, Inject } from '@nestjs/common';
import { ObservabilityRepository } from './observability.repository';
import { ObservabilityProvider } from './observability.provider';
import * as client from 'prom-client';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly register: client.Registry;

  // Prometheus Metrics
  public readonly intentAccuracy: client.Counter;
  public readonly planningSuccessRate: client.Counter;
  public readonly e2eLatency: client.Histogram;

  constructor(
    @Inject(ObservabilityRepository) private readonly observabilityRepository: ObservabilityRepository,
    @Inject(ObservabilityProvider) private readonly observabilityProvider: ObservabilityProvider,
  ) {
    this.register = new client.Registry();
    // Add default metrics
    client.collectDefaultMetrics({ register: this.register });

    this.intentAccuracy = new client.Counter({
      name: 'agent_intent_accuracy_total',
      help: 'Total count of intent recognition results',
      labelNames: ['status'], // 'success', 'fail'
      registers: [this.register],
    });

    this.planningSuccessRate = new client.Counter({
      name: 'agent_planning_success_total',
      help: 'Total count of planning results',
      labelNames: ['status'], // 'success', 'fail'
      registers: [this.register],
    });

    this.e2eLatency = new client.Histogram({
      name: 'agent_e2e_latency_seconds',
      help: 'End-to-end latency in seconds',
      buckets: [0.1, 0.2, 0.5, 0.8, 1, 2, 5], // 0.8s is the P99 target
      registers: [this.register],
    });
  }

  async getPrometheusMetrics() {
    return this.register.metrics();
  }

  resolveTraceId(value: unknown) {
    return this.observabilityProvider.resolveTraceId(value);
  }

  recordRequest(params: {
    traceId: string;
    userId?: string;
    route?: string;
    statusCode?: number;
    errorCode?: string;
    durationMs?: number;
    conversationId?: string;
    taskId?: string;
  }) {
    // Standard stdout JSON log
    console.log(
      JSON.stringify({
        level: 'info',
        timestamp: new Date().toISOString(),
        traceId: params.traceId,
        userId: params.userId ?? null,
        route: params.route ?? null,
        statusCode: params.statusCode ?? null,
        errorCode: params.errorCode ?? null,
        durationMs: params.durationMs ?? null,
        conversationId: params.conversationId ?? null,
        taskId: params.taskId ?? null,
      }),
    );
  }

  recordChatTtftMs(value: number) {
    if (!Number.isFinite(value)) {
      return;
    }
    this.observabilityRepository.recordTimer('chat_ttft_ms', value);
  }

  recordChatStreamInterrupt(interrupted: boolean) {
    this.observabilityRepository.incrementCounter('chat_stream_total', 1);
    if (interrupted) {
      this.observabilityRepository.incrementCounter('chat_stream_interrupt', 1);
    }
  }

  recordChatError(code: string) {
    if (!code) {
      return;
    }
    this.observabilityRepository.incrementLabeledCounter('chat_error_rate_by_code', code, 1);
  }

  recordTokenUsage(totalTokens: number) {
    if (!Number.isFinite(totalTokens) || totalTokens <= 0) {
      return;
    }
    this.observabilityRepository.incrementCounter('token_usage_total', totalTokens);
  }

  getMetricsSnapshot() {
    const snapshot = this.observabilityRepository.getSnapshot();
    const streamTotal = snapshot.counters.chat_stream_total ?? 0;
    const streamInterrupted = snapshot.counters.chat_stream_interrupt ?? 0;
    const interruptRate = streamTotal > 0 ? streamInterrupted / streamTotal : 0;
    return {
      metrics: {
        chat_ttft_ms: snapshot.timers.chat_ttft_ms ?? {
          count: 0,
          sum: 0,
          min: 0,
          max: 0,
          last: 0,
        },
        chat_stream_interrupt_rate: {
          total: streamTotal,
          interrupted: streamInterrupted,
          rate: interruptRate,
        },
        chat_error_rate_by_code: snapshot.labeledCounters.chat_error_rate_by_code ?? {},
        token_usage_total: snapshot.counters.token_usage_total ?? 0,
      },
    };
  }
}
