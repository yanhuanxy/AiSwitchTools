import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';

@Injectable()
export class ObservabilityProvider {
  generateTraceId() {
    return `tr_${ulid()}`;
  }

  resolveTraceId(value: unknown) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0) {
      return value[0];
    }
    return this.generateTraceId();
  }
}
