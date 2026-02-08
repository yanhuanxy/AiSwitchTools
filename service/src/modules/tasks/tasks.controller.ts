import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TasksService } from './tasks.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('chat/tasks')
@UseGuards(AuthGuard)
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}

  @Get(':taskId/events')
  async streamEvents(
    @Param('taskId') taskId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ownerUserId = (req as any).user.id;
    await this.tasksService.streamEvents(ownerUserId, taskId, req, res);
  }

  @Post(':taskId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('taskId') taskId: string, @Req() req: Request) {
    const ownerUserId = (req as any).user.id;
    const result = await this.tasksService.cancelTask(ownerUserId, taskId);
    const traceId = req.headers['x-trace-id'] as string;
    return {
      taskId: result.taskId,
      status: result.status,
      traceId,
    };
  }
}
