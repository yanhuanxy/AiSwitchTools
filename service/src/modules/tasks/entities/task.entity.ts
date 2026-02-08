export interface TaskEntity {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'canceled' | 'failed';
}
