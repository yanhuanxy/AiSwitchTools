import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SafetyRepository } from './safety.repository';
import { ContentSafetyResult, RateLimitResult, SafetyProvider } from './safety.provider';

export interface SafetyRateLimitResult extends RateLimitResult {
  degraded: boolean;
  errorRate: number;
  errorWindowMs: number;
  errorRateThreshold: number;
}

export interface SafetyContentResult extends ContentSafetyResult {
  direction: 'input' | 'output';
}

export interface AttachmentSafetyInput {
  id: string;
  scanStatus: 'pending' | 'passed' | 'rejected' | 'failed';
}

@Injectable()
export class SafetyService {
  private readonly errorRateThreshold: number;

  constructor(
    @Inject(SafetyProvider) private readonly safetyProvider: SafetyProvider,
    @Inject(SafetyRepository) private readonly safetyRepository: SafetyRepository,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService,
  ) {
    this.errorRateThreshold = this.configService?.get('SAFETY_ERROR_RATE_THRESHOLD', 0.05) ?? 0.05;
  }

  checkRateLimit(ownerUserId: string, route: string): SafetyRateLimitResult {
    const key = this.buildKey(ownerUserId, route);
    const rateLimitResult = this.safetyProvider.checkRateLimit(key);
    const errorRateSnapshot = this.safetyRepository.getErrorRate(key);
    const degraded = errorRateSnapshot.total > 0 && errorRateSnapshot.errorRate > this.errorRateThreshold;

    return {
      ...rateLimitResult,
      degraded,
      errorRate: errorRateSnapshot.errorRate,
      errorWindowMs: errorRateSnapshot.windowMs,
      errorRateThreshold: this.errorRateThreshold,
    };
  }

  recordRequestOutcome(ownerUserId: string, route: string, success: boolean): void {
    const key = this.buildKey(ownerUserId, route);
    this.safetyRepository.recordOutcome(key, success);
  }

  checkContentSafety(content: string, direction: 'input' | 'output'): SafetyContentResult {
    const result = this.safetyProvider.evaluateContent(content);
    return {
      ...result,
      direction,
    };
  }

  filterAttachmentsForPrompt(attachments: AttachmentSafetyInput[]): string[] {
    return attachments
      .filter((attachment) => attachment.scanStatus === 'passed')
      .map((attachment) => attachment.id);
  }

  getRateLimitConfig(): { perSecond: number; burst: number } {
    return this.safetyProvider.getRateLimitConfig();
  }

  private buildKey(ownerUserId: string, route: string): string {
    return `${ownerUserId}:${route}`;
  }
}
