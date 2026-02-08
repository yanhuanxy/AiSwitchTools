import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('knowledge-bases')
@UseGuards(AuthGuard)
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post()
  create(@Request() req, @Body() createKnowledgeBaseDto: CreateKnowledgeBaseDto) {
    return this.knowledgeBaseService.create(req.user.id, createKnowledgeBaseDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.knowledgeBaseService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.knowledgeBaseService.findOne(id, req.user.id);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() updateKnowledgeBaseDto: UpdateKnowledgeBaseDto) {
    return this.knowledgeBaseService.update(id, req.user.id, updateKnowledgeBaseDto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.knowledgeBaseService.remove(id, req.user.id);
  }
}
