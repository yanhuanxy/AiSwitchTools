import { Injectable } from '@nestjs/common';

type TimerMetric = {
  count: number;
  sum: number;
  min: number;
  max: number;
  last: number;
};

@Injectable()
export class ObservabilityRepository {
  private readonly counters = new Map<string, number>();
  private readonly labeledCounters = new Map<string, Map<string, number>>();
  private readonly timers = new Map<string, TimerMetric>();

  incrementCounter(name: string, value = 1) {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
  }

  incrementLabeledCounter(name: string, label: string, value = 1) {
    const group = this.labeledCounters.get(name) ?? new Map<string, number>();
    const current = group.get(label) ?? 0;
    group.set(label, current + value);
    this.labeledCounters.set(name, group);
  }

  recordTimer(name: string, value: number) {
    const current = this.timers.get(name);
    if (!current) {
      this.timers.set(name, {
        count: 1,
        sum: value,
        min: value,
        max: value,
        last: value,
      });
      return;
    }
    this.timers.set(name, {
      count: current.count + 1,
      sum: current.sum + value,
      min: Math.min(current.min, value),
      max: Math.max(current.max, value),
      last: value,
    });
  }

  getSnapshot() {
    const counters: Record<string, number> = {};
    for (const [key, value] of this.counters.entries()) {
      counters[key] = value;
    }
    const labeledCounters: Record<string, Record<string, number>> = {};
    for (const [key, value] of this.labeledCounters.entries()) {
      labeledCounters[key] = {};
      for (const [label, count] of value.entries()) {
        labeledCounters[key][label] = count;
      }
    }
    const timers: Record<string, TimerMetric> = {};
    for (const [key, value] of this.timers.entries()) {
      timers[key] = value;
    }
    return { counters, labeledCounters, timers };
  }
}
