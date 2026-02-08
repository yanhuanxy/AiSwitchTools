import { Injectable } from '@nestjs/common';

@Injectable()
export class TasksProvider {
  getHeartbeatMs() {
    return 30000;
  }

  getIdleTimeoutMs() {
    return 60000;
  }

  getPollIntervalMs() {
    return 1000;
  }
}
