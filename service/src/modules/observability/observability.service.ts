import { Injectable, Logger, Inject } from '@nestjs/common';
import { ObservabilityRepository } from './observability.repository';
import { ObservabilityProvider } from './observability.provider';

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(
    @Inject(ObservabilityRepository) private readonly observabilityRepository: ObservabilityRepository,
    @Inject(ObservabilityProvider) private readonly observabilityProvider: ObservabilityProvider,
  ) {}

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
