import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Logger, InternalServerErrorException, Inject, UseInterceptors, UploadedFile, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { KnowledgeBaseService } from './knowledge-base.service';
import { RagService } from '../rag/rag.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('knowledge-bases')
@UseGuards(AuthGuard)
export class KnowledgeBaseController {
  private readonly logger = new Logger(KnowledgeBaseController.name);

  constructor(
    @Inject(KnowledgeBaseService) private readonly knowledgeBaseService: KnowledgeBaseService,
    @Inject(RagService) private readonly ragService: RagService
  ) {}

  @Post()
  create(@Req() req: Request, @Body() createKnowledgeBaseDto: CreateKnowledgeBaseDto) {
    this.ensureService();
    return this.knowledgeBaseService.create((req as any).user.id, createKnowledgeBaseDto);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: Request,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!id) throw new BadRequestException('Knowledge Base ID is missing');
    const userId = (req as any).user?.id;
    if (!userId) throw new BadRequestException('User ID is missing');
    
    try {
        // Verify KB ownership
        const kb = await this.knowledgeBaseService.findOne(id, userId);
        if (!kb) throw new BadRequestException('Knowledge Base not found');

        // Fix garbled filename encoding (Multer defaults to latin1)
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

        return await this.ragService.ingestDocument(userId, id, {
            buffer: file.buffer,
            originalname: originalName,
            mimetype: file.mimetype
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Database connection failed')) {
            this.logger.error(`Upload failed for user ${userId}, file ${file.originalname}: ${message}`);
            throw new ServiceUnavailableException('Database service is currently unavailable. Please try again later.');
        }
        throw error;
    }
  }

  @Delete(':id/documents/:docId')
  async deleteDocument(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('docId') docId: string
  ) {
      // Verify KB ownership (optional, RagService checks doc ownership via KB)
      // But strictly we should check if doc belongs to this KB too.
      // RagService.deleteDocument checks if doc.knowledgeBase.ownerUserId === userId.
      return this.ragService.deleteDocument((req as any).user.id, docId);
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
