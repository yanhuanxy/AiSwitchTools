import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('workflows')
@UseGuards(AuthGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  create(@Request() req, @Body() createWorkflowDto: CreateWorkflowDto) {
    return this.workflowService.create(req.user.id, createWorkflowDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.workflowService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.workflowService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() updateWorkflowDto: UpdateWorkflowDto) {
    return this.workflowService.update(id, req.user.id, updateWorkflowDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.workflowService.remove(id, req.user.id);
  }
}
