import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  Res,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AttachmentsService } from './attachments.service';
import { AttachmentResponseDto, AttachmentListResponseDto } from './dto';
import { IsString, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';

class GenerateUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsNumber()
  @Min(1)
  @Max(10 * 1024 * 1024) // 10MB
  size!: number;
}
@Controller('attachments')
@UseGuards(AuthGuard)
export class AttachmentsController {
  constructor(@Inject(AttachmentsService) private readonly attachmentsService: AttachmentsService) {}

  /**
   * 获取附件信息
   * GET /api/attachments/:id
   */
  @Get(':id')
  async getAttachment(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('includeMetadata') includeMetadata?: string,
  ): Promise<AttachmentResponseDto> {
    const ownerUserId = (req as any).user.id;
    const options = {
      includeMetadata: includeMetadata === 'true' || includeMetadata === '1',
    };
    const result = await this.attachmentsService.getAttachment(id, ownerUserId, options);
    const traceId = req.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  /**
   * 获取用户附件列表
   * GET /api/attachments?cursor=&limit=
   */
  @Get()
  async listAttachments(
    @Req() req: Request,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<AttachmentListResponseDto> {
    const ownerUserId = (req as any).user.id;
    const limitNum = Math.min(parseInt(limit || '20'), 100);
    const result = await this.attachmentsService.listAttachments(ownerUserId, cursor, limitNum);
    const traceId = req.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  /**
   * 删除附件
   * DELETE /api/attachments/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAttachment(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const ownerUserId = (req as any).user.id;
    await this.attachmentsService.deleteAttachment(id, ownerUserId);
  }

  /**
   * 下载附件（代理）
   * GET /api/attachments/:id/download?token=
   */
  @Get(':id/download')
  async downloadAttachment(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
    @Query('token') token?: string,
  ): Promise<void> {
    const ownerUserId = (req as any).user.id;
    const isTokenValid = this.attachmentsService.validateDownloadToken(
      token ?? '',
      ownerUserId,
      id,
    );
    if (!isTokenValid) {
      res.status(HttpStatus.UNAUTHORIZED).json({ error: 'INVALID_TOKEN' });
      return;
    }
    const attachment = await this.attachmentsService.getAttachment(id, ownerUserId);
    if (attachment.scanStatus !== 'passed') {
      res.status(HttpStatus.FORBIDDEN).json({ error: 'ATTACHMENT_NOT_READY' });
      return;
    }
    const filePath = await this.attachmentsService.resolveLocalPath(id, ownerUserId);
    res.sendFile(filePath);
  }

  /**
   * 生成上传URL（直传对象存储）
   * POST /api/attachments/generate-upload-url
   */
  @Post('generate-upload-url')
  async generateUploadUrl(
    @Body(ValidationPipe) dto: GenerateUploadUrlDto,
    @Req() req: Request,
  ): Promise<{
    attachmentId: string;
    uploadUrl: string;
    storageKey: string;
    expiresAt: Date;
    traceId: string;
  }> {
    const ownerUserId = (req as any).user.id;
    const result = await this.attachmentsService.generateUploadUrl(
      ownerUserId,
      dto.filename,
      dto.mimeType,
      dto.size,
    );
    const traceId = req.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  /**
   * 获取扫描统计
   * GET /api/attachments/stats/scan
   */
  @Get('stats/scan')
  async getScanStats(@Req() req: Request): Promise<{
    pending: number;
    passed: number;
    rejected: number;
    failed: number;
    traceId: string;
  }> {
    // 这个接口可以不需要用户认证，或者只允许管理员
    // 暂时允许所有用户查看全局统计
    const result = await this.attachmentsService.getScanStats();
    const traceId = req.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  /**
   * 验证附件所有权（内部接口）
   * GET /api/attachments/:id/validate
   */
  @Get(':id/validate')
  async validateOwnership(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ valid: boolean; traceId: string }> {
    const ownerUserId = (req as any).user.id;
    const valid = await this.attachmentsService.validateOwnership(id, ownerUserId);
    const traceId = req.headers['x-trace-id'] as string;
    return { valid, traceId };
  }

  /**
   * 批量验证附件所有权（内部接口）
   * POST /api/attachments/validate-batch
   */
  @Post('validate-batch')
  async validateOwnershipBatch(
    @Body() body: { attachmentIds: string[] },
    @Req() req: Request,
  ): Promise<{ valid: boolean; traceId: string }> {
    const ownerUserId = (req as any).user.id;
    const valid = await this.attachmentsService.validateOwnershipBatch(
      body.attachmentIds,
      ownerUserId,
    );
    const traceId = req.headers['x-trace-id'] as string;
    return { valid, traceId };
  }

  /**
   * 过滤可用于模型理解的附件（内部接口）
   * POST /api/attachments/filter-for-model
   */
  @Post('filter-for-model')
  async filterAttachmentsForModel(
    @Body() body: { attachmentIds: string[] },
    @Req() req: Request,
  ): Promise<{ attachmentIds: string[]; traceId: string }> {
    const ownerUserId = (req as any).user.id;
    const filteredIds = await this.attachmentsService.filterAttachmentsForModel(
      body.attachmentIds,
      ownerUserId,
    );
    const traceId = req.headers['x-trace-id'] as string;
    return { attachmentIds: filteredIds, traceId };
  }

  /**
   * 获取存储配置（内部接口）
   * GET /api/attachments/config/storage
   */
  @Get('config/storage')
  async getStorageConfig(@Req() req: Request): Promise<any> {
    // 可以限制为管理员访问
    const result = await this.attachmentsService.getStorageConfig();
    const traceId = req.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }
}
