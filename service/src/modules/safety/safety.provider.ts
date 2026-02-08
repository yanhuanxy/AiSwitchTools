import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

export interface ContentSafetyResult {
  allowed: boolean;
  issues: string[];
  redactedContent: string;
}

type TokenBucket = {
  tokens: number;
  lastRefill: number;
};

@Injectable()
export class SafetyProvider {
  private readonly rateLimitPerSecond: number;
  private readonly rateLimitBurst: number;
  private readonly blockedKeywords: string[];
  private readonly blockedPatterns: RegExp[];
  private readonly sensitivePatterns: Array<{ regex: RegExp; replacement: string }>;
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(private readonly configService?: ConfigService) {
    this.rateLimitPerSecond = this.configService?.get('SAFETY_RATE_LIMIT_PER_SEC', 5) ?? 5;
    this.rateLimitBurst = this.configService?.get('SAFETY_RATE_LIMIT_BURST', 10) ?? 10;
    this.blockedKeywords = this.normalizeList(
      this.configService?.get('SAFETY_BLOCKED_KEYWORDS', []) ?? []
    );
    const patternList = this.normalizeList(
      this.configService?.get('SAFETY_BLOCKED_PATTERNS', []) ?? []
    );
    this.blockedPatterns = patternList.map((pattern) => new RegExp(pattern, 'i'));
    this.sensitivePatterns = [
      { regex: /1[3-9]\d{9}/g, replacement: '[PHONE]' },
      { regex: /\d{3}-\d{4}-\d{4}/g, replacement: '[PHONE]' },
      { regex: /\d{4}-\d{7}/g, replacement: '[PHONE]' },
      { regex: /\d{17}[\dXx]/g, replacement: '[ID_CARD]' },
      { regex: /\d{15}/g, replacement: '[ID_CARD]' },
      { regex: /\d{16,19}/g, replacement: '[BANK_CARD]' },
      { regex: /\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}/g, replacement: '[BANK_CARD]' },
    ];
  }

  checkRateLimit(key: string): RateLimitResult {
    const now = Date.now();
    const bucket = this.getBucket(key, now);
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      this.rateLimitBurst,
      bucket.tokens + elapsedSeconds * this.rateLimitPerSecond,
    );
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      const retryAfterMs = Math.ceil(((1 - bucket.tokens) / this.rateLimitPerSecond) * 1000);
      return {
        allowed: false,
        limit: this.rateLimitBurst,
        remaining: 0,
        resetAt: new Date(now + retryAfterMs),
        retryAfterMs,
      };
    }

    bucket.tokens -= 1;
    const remaining = Math.max(0, Math.floor(bucket.tokens));
    const resetMs = Math.ceil(((this.rateLimitBurst - bucket.tokens) / this.rateLimitPerSecond) * 1000);
    return {
      allowed: true,
      limit: this.rateLimitBurst,
      remaining,
      resetAt: new Date(now + resetMs),
    };
  }

  evaluateContent(content: string): ContentSafetyResult {
    let redactedContent = content || '';
    const issues: string[] = [];

    for (const pattern of this.sensitivePatterns) {
      if (pattern.regex.test(redactedContent)) {
        redactedContent = redactedContent.replace(pattern.regex, pattern.replacement);
        issues.push('sensitive_data');
      }
    }

    const keywordHits = this.blockedKeywords.filter((keyword) => redactedContent.includes(keyword));
    if (keywordHits.length > 0) {
      issues.push(`blocked_keywords:${keywordHits.join(',')}`);
    }

    for (const pattern of this.blockedPatterns) {
      if (pattern.test(redactedContent)) {
        issues.push('blocked_pattern');
        break;
      }
    }

    const allowed = !issues.some((issue) => issue.startsWith('blocked_'));

    return {
      allowed,
      issues,
      redactedContent,
    };
  }

  getRateLimitConfig(): { perSecond: number; burst: number } {
    return {
      perSecond: this.rateLimitPerSecond,
      burst: this.rateLimitBurst,
    };
  }

  private getBucket(key: string, now: number): TokenBucket {
    const existing = this.buckets.get(key);
    if (existing) {
      return existing;
    }
    const bucket = { tokens: this.rateLimitBurst, lastRefill: now };
    this.buckets.set(key, bucket);
    return bucket;
  }

  private normalizeList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
    }
    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
    }
    return [];
  }
}
