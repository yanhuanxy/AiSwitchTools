import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Logger, InternalServerErrorException, Inject } from '@nestjs/common';
import type { Request } from 'express';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('workflows')
@UseGuards(AuthGuard)
export class WorkflowController {
  private readonly logger = new Logger(WorkflowController.name);

  constructor(@Inject(WorkflowService) private readonly workflowService: WorkflowService) {}

  @Post()
  create(@Req() req: Request, @Body() createWorkflowDto: CreateWorkflowDto) {
    if (!this.workflowService) {
      this.logger.error('WorkflowService 未注入，请检查模块依赖');
      throw new InternalServerErrorException('服务初始化失败');
    }
    return this.workflowService.create((req as any).user.id, createWorkflowDto);
  }

  @Get()
  findAll(@Req() req: Request) {
    return this.workflowService.findAll((req as any).user.id);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.workflowService.findOne(id, (req as any).user.id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() updateWorkflowDto: UpdateWorkflowDto) {
    return this.workflowService.update(id, (req as any).user.id, updateWorkflowDto);
  }

  @Post(':id/publish')
  publish(@Req() req: Request, @Param('id') id: string) {
    return this.workflowService.publish(id, (req as any).user.id);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.workflowService.remove(id, (req as any).user.id);
  }
}
