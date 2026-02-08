import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ErrorRecord = {
  total: number[];
  failed: number[];
};

@Injectable()
export class SafetyRepository {
  private readonly errorWindowMs: number;
  private readonly errorRecords = new Map<string, ErrorRecord>();

  constructor(@Optional() @Inject(ConfigService) private readonly configService?: ConfigService) {
    this.errorWindowMs = this.configService?.get('SAFETY_ERROR_WINDOW_MS', 60000) ?? 60000;
  }

  recordOutcome(key: string, success: boolean): void {
    const record = this.getOrCreate(key);
    const now = Date.now();
    record.total.push(now);
    if (!success) {
      record.failed.push(now);
    }
    this.trim(record, now);
  }

  getErrorRate(key: string): {
    total: number;
    failed: number;
    errorRate: number;
    windowMs: number;
  } {
    const record = this.getOrCreate(key);
    const now = Date.now();
    this.trim(record, now);
    const total = record.total.length;
    const failed = record.failed.length;
    const errorRate = total === 0 ? 0 : failed / total;
    return {
      total,
      failed,
      errorRate,
      windowMs: this.errorWindowMs,
    };
  }

  private getOrCreate(key: string): ErrorRecord {
    const existing = this.errorRecords.get(key);
    if (existing) {
      return existing;
    }
    const created = { total: [], failed: [] };
    this.errorRecords.set(key, created);
    return created;
  }

  private trim(record: ErrorRecord, now: number): void {
    const cutoff = now - this.errorWindowMs;
    while (record.total.length && record.total[0] < cutoff) {
      record.total.shift();
    }
    while (record.failed.length && record.failed[0] < cutoff) {
      record.failed.shift();
    }
  }
}
