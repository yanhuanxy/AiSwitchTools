import { Injectable, NotFoundException, ConflictException, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';
import crypto from 'node:crypto';
import { AttachmentsRepository } from './attachments.repository';
import { AttachmentsProvider } from './attachments.provider';
import { AttachmentResponseDto, AttachmentListResponseDto } from './dto';
import { AttachmentEntity } from './entities';
import { PrismaService } from '../../prisma/prisma.service';

export interface GetAttachmentOptions {
  includeMetadata?: boolean;
  generateSignedUrl?: boolean;
}

@Injectable()
export class AttachmentsService {
  private readonly maxUploadsPerUser: number;
  private readonly signedUrlExpiry: number;

  constructor(
    @Inject(AttachmentsRepository) private readonly attachmentsRepository: AttachmentsRepository,
    @Inject(AttachmentsProvider) private readonly attachmentsProvider: AttachmentsProvider,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(ConfigService) private readonly configService?: ConfigService,
  ) {
    this.maxUploadsPerUser =
      this.configService?.get('MAX_UPLOADS_PER_USER', 1000) ?? 1000;
    this.signedUrlExpiry =
      this.configService?.get('SIGNED_URL_EXPIRY', 3600) ?? 3600; // 1小时
  }

  /**
   * 获取附件文件内容 (Buffer)
   */
  async getAttachmentFileBuffer(id: string, ownerUserId: string): Promise<{ buffer: Buffer; mime: string }> {
      const attachment = await this.attachmentsRepository.findByIdAndOwner(id, ownerUserId);
      if (!attachment) {
        throw new NotFoundException(`Attachment ${id} not found`);
      }
      const buffer = await this.attachmentsProvider.getFileBuffer(attachment.storageKey);
      return { buffer, mime: attachment.mime };
  }

  /**
   * 获取附件信息
   */
  async getAttachment(
    id: string,
    ownerUserId: string,
    options: GetAttachmentOptions = {},
  ): Promise<AttachmentResponseDto> {
    const attachment = await this.attachmentsRepository.findByIdAndOwner(id, ownerUserId);
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    const viewUrl =
      attachment.scanStatus === 'passed'
        ? this.buildProxyUrl(id, this.generateDownloadToken(ownerUserId, id))
        : null;

    const response: AttachmentResponseDto = {
      attachmentId: attachment.id,
      scanStatus: attachment.scanStatus,
      viewUrl,
    };

    if (options.includeMetadata) {
      response.mime = attachment.mime;
      response.size = attachment.size;
      response.width = attachment.width;
      response.height = attachment.height;
      response.createdAt = attachment.createdAt;
    }

    return response;
  }

  /**
   * 获取用户附件列表
   */
  async listAttachments(
    ownerUserId: string,
    cursor?: string,
    limit: number = 20,
  ): Promise<AttachmentListResponseDto> {
    const { items, nextCursor } = await this.attachmentsRepository.findByOwner(
      ownerUserId,
      cursor,
      limit,
    );

    const enrichedItems = items.map((attachment) => {
      const viewUrl =
        attachment.scanStatus === 'passed'
          ? this.buildProxyUrl(attachment.id, this.generateDownloadToken(ownerUserId, attachment.id))
          : null;
      return {
        attachmentId: attachment.id,
        scanStatus: attachment.scanStatus,
        viewUrl,
        mime: attachment.mime,
        size: attachment.size,
        width: attachment.width,
        height: attachment.height,
        createdAt: attachment.createdAt,
      };
    });

    return {
      items: enrichedItems,
      nextCursor,
    };
  }

  /**
   * 删除附件
   * 软删除关联记录，物理删除附件
   */
  async deleteAttachment(id: string, ownerUserId: string): Promise<{ attachmentId: string; deleted: boolean }> {
    const attachment = await this.attachmentsRepository.findByIdAndOwner(id, ownerUserId);
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    // 删除数据库记录（级联软删除关联记录）
    await this.attachmentsRepository.deleteById(id);

    // 删除物理文件（异步，失败不阻塞）
    try {
      await this.attachmentsProvider.deleteFile(attachment.storageKey);
    } catch (error) {
      console.error(`Failed to delete file ${attachment.storageKey}:`, error);
      // 记录错误但不抛出，保持删除成功状态
    }

    return {
      attachmentId: id,
      deleted: true,
    };
  }

  async resolveLocalPath(attachmentId: string, ownerUserId: string): Promise<string> {
    const attachment = await this.attachmentsRepository.findByIdAndOwner(
      attachmentId,
      ownerUserId,
    );
    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }
    try {
      return this.attachmentsProvider.resolveLocalPath(attachment.storageKey);
    } catch {
      throw new HttpException('LOCAL_STORAGE_DISABLED', HttpStatus.NOT_IMPLEMENTED);
    }
  }

  /**
   * 批量获取附件（用于消息发送时的验证）
   */
  async getAttachmentsByIds(ids: string[], ownerUserId: string): Promise<AttachmentEntity[]> {
    return this.attachmentsRepository.findByIdsAndOwner(ids, ownerUserId);
  }

  /**
   * 验证批量所有权
   */
  async validateOwnershipBatch(ids: string[], ownerUserId: string): Promise<boolean> {
    if (!ids || ids.length === 0) return true;
    const attachments = await this.getAttachmentsByIds(ids, ownerUserId);
    return attachments.length === ids.length;
  }

  /**
   * 过滤可用于模型理解的附件（仅passed状态）
   */
  async filterAttachmentsForModel(attachmentIds: string[], ownerUserId: string): Promise<string[]> {
    if (!attachmentIds || attachmentIds.length === 0) {
      return [];
    }

    const attachments = await this.attachmentsRepository.findByIdsAndOwner(attachmentIds, ownerUserId);
    return attachments
      .filter((attachment) => attachment.scanStatus === 'passed')
      .map((attachment) => attachment.id);
  }

  /**
   * 扫描服务：获取待扫描的附件
   */
  async getPendingAttachments(): Promise<AttachmentEntity[]> {
    return this.attachmentsRepository.findPendingForScan();
  }

  /**
   * 扫描服务：更新扫描结果
   */
  async updateScanResult(
    id: string,
    scanStatus: 'passed' | 'rejected' | 'failed',
    metadata?: { width?: number; height?: number },
  ): Promise<AttachmentEntity> {
    const attachment = await this.attachmentsRepository.findById(id);
    if (!attachment) {
      throw new NotFoundException(`Attachment ${id} not found`);
    }

    // 获取文件元信息（仅在passed状态时）
    let fileMetadata = {};
    if (scanStatus === 'passed') {
      try {
        fileMetadata = await this.attachmentsProvider.getFileMetadata(attachment.storageKey);
      } catch (error) {
        console.error(`Failed to get metadata for ${attachment.storageKey}:`, error);
        // 忽略元信息获取失败
      }
    }

    return this.attachmentsRepository.updateScanStatus(id, scanStatus, {
      ...metadata,
      ...fileMetadata,
    });
  }

  /**
   * 生成上传URL（用于客户端直传）
   */
  async generateUploadUrl(
    ownerUserId: string,
    filename: string,
    mimeType: string,
    size: number,
  ): Promise<{
    attachmentId: string;
    uploadUrl: string;
    storageKey: string;
    expiresAt: Date;
  }> {
    // 验证文件类型和大小
    this.validateUploadFile(mimeType, size);

    // 检查用户上传限制
    const userUploadCount = await this.getUserUploadCount(ownerUserId);
    if (userUploadCount >= this.maxUploadsPerUser) {
      throw new ConflictException(`User ${ownerUserId} has reached the maximum upload limit`);
    }

    // 生成附件ID和存储路径
    const { ulid } = require('ulid');
    const ulidValue = ulid();
    const attachmentId = `att_${ulidValue}`;
    const extension = this.getFileExtension(mimeType);
    const safeName = this.sanitizeOriginalName(filename, extension);
    const storageKey = `${ownerUserId}/${ulidValue}_${safeName}`;

    // 生成上传URL
    const { url, expiresAt } = await this.attachmentsProvider.generateUploadUrl(storageKey);

    // 创建附件记录（状态为pending）
    await this.attachmentsRepository.create({
      id: attachmentId,
      ownerUserId,
      type: 'image',
      storageKey,
      mime: mimeType,
      size,
    });

    return {
      attachmentId,
      uploadUrl: url,
      storageKey,
      expiresAt,
    };
  }

  /**
   * 获取用户上传统计
   */
  async getUserUploadCount(ownerUserId: string): Promise<number> {
    return this.prisma.attachment.count({
      where: { ownerUserId },
    });
  }

  /**
   * 获取扫描统计
   */
  async getScanStats(): Promise<{
    pending: number;
    passed: number;
    rejected: number;
    failed: number;
  }> {
    return this.attachmentsRepository.getScanStats();
  }

  /**
   * 清理失败的附件
   */
  async cleanupFailedAttachments(olderThanHours: number = 24): Promise<number> {
    return this.attachmentsRepository.cleanupFailedAttachments(olderThanHours);
  }

  /**
   * 验证上传文件
   */
  private validateUploadFile(mimeType: string, size: number): void {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
      throw new ConflictException(`Unsupported file type: ${mimeType}`);
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (size > maxSize) {
      throw new ConflictException(`File size exceeds the limit of ${maxSize / 1024 / 1024}MB`);
    }
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return map[mimeType] || 'bin';
  }

  /**
   * 净化文件名
   */
  private sanitizeOriginalName(filename: string, extension: string): string {
    const name = path.basename(filename, path.extname(filename));
    const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
    return `${safeName}.${extension}`;
  }

  /**
   * 构建代理URL
   */
  private buildProxyUrl(attachmentId: string, token: string): string {
    // 假设前端代理路径为 /api/attachments/view/:id?token=...
    return `/api/attachments/view/${attachmentId}?token=${token}`;
  }

  /**
   * 生成下载令牌
   */
  private generateDownloadToken(ownerUserId: string, attachmentId: string): string {
    // 简单生成一个带签名的令牌
    const payload = `${ownerUserId}:${attachmentId}:${Date.now() + 3600000}`; // 1小时有效
    const secret = this.configService?.get('JWT_SECRET', 'secret');
    const signature = crypto
      .createHmac('sha256', secret || 'secret')
      .update(payload)
      .digest('hex');
    return Buffer.from(`${payload}:${signature}`).toString('base64');
  }
}
