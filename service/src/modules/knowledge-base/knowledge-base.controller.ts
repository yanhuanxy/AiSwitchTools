import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Logger, InternalServerErrorException, Inject } from '@nestjs/common';
import type { Request } from 'express';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('knowledge-bases')
@UseGuards(AuthGuard)
export class KnowledgeBaseController {
  private readonly logger = new Logger(KnowledgeBaseController.name);

  constructor(@Inject(KnowledgeBaseService) private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post()
  create(@Req() req: Request, @Body() createKnowledgeBaseDto: CreateKnowledgeBaseDto) {
    this.ensureService();
    return this.knowledgeBaseService.create((req as any).user.id, createKnowledgeBaseDto);
  }

  @Get()
  findAll(@Req() req: Request) {
    this.ensureService();
    return this.knowledgeBaseService.findAll((req as any).user.id);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    this.ensureService();
    return this.knowledgeBaseService.findOne(id, (req as any).user.id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() updateKnowledgeBaseDto: UpdateKnowledgeBaseDto) {
    this.ensureService();
    return this.knowledgeBaseService.update(id, (req as any).user.id, updateKnowledgeBaseDto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    this.ensureService();
    return this.knowledgeBaseService.remove(id, (req as any).user.id);
  }

  private ensureService() {
    if (!this.knowledgeBaseService) {
      this.logger.error('KnowledgeBaseService 未注入，请检查模块依赖');
      throw new InternalServerErrorException('服务初始化失败');
    }
  }
}
