import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import path from 'node:path';

export interface StorageConfig {
  provider: 'local' | 's3' | 'minio';
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  signedUrlExpiry: number; // 秒
}

export interface SignedUrlResponse {
  url: string;
  expiresAt: Date;
}

@Injectable()
export class AttachmentsProvider {
  private readonly storageConfig: StorageConfig;
  private readonly envName: string;

  constructor(private readonly configService?: ConfigService) {
    this.envName = this.normalizeEnv(
      this.configService?.get('APP_ENV') ??
        this.configService?.get('NODE_ENV', 'dev') ??
        'dev'
    );
    const provider =
      this.configService?.get('STORAGE_MODE') ??
      this.configService?.get('STORAGE_PROVIDER', 'local') ??
      'local';
    const bucketName =
      this.configService?.get('STORAGE_BUCKET') ?? `ai-app-uploads-${this.envName}`;
    this.storageConfig = {
      provider: this.normalizeProvider(provider),
      bucket: bucketName,
      region: this.configService?.get('STORAGE_REGION', 'us-east-1') ?? 'us-east-1',
      endpoint: this.configService?.get('STORAGE_ENDPOINT'),
      accessKey: this.configService?.get('STORAGE_ACCESS_KEY'),
      secretKey: this.configService?.get('STORAGE_SECRET_KEY'),
      signedUrlExpiry: this.configService?.get('SIGNED_URL_EXPIRY', 3600) ?? 3600, // 1小时
    };
  }

  /**
   * 生成文件的访问URL
   * 仅当scanStatus=passed时返回真实的签名URL
   */
  async generateViewUrl(storageKey: string, scanStatus: string): Promise<string | null> {
    if (scanStatus !== 'passed') {
      return null;
    }

    if (this.storageConfig.provider === 'local') {
      // 本地存储模式，返回相对路径
      const safeKey = storageKey.replace(/\\/g, '/');
      return `/uploads/${this.storageConfig.bucket}/${safeKey}`;
    }

    // TODO: 实现S3/MinIO的预签名URL
    // 这里需要集成AWS SDK或MinIO客户端
    throw new Error('S3/MinIO provider not implemented yet');
  }

  /**
   * 生成上传URL（用于客户端直传）
   */
  async generateUploadUrl(storageKey: string): Promise<SignedUrlResponse> {
    const expiresAt = new Date(Date.now() + this.storageConfig.signedUrlExpiry * 1000);

    if (this.storageConfig.provider === 'local') {
      // 本地存储模式，返回临时上传路径
      return {
        url: `/api/uploads/direct/${this.storageConfig.bucket}/${storageKey}`,
        expiresAt,
      };
    }

    // TODO: 实现S3/MinIO的上传预签名URL
    throw new Error('S3/MinIO provider not implemented yet');
  }

  /**
   * 删除文件
   */
  async deleteFile(storageKey: string): Promise<void> {
    if (this.storageConfig.provider === 'local') {
      // 本地存储模式，直接删除文件
      const fs = require('node:fs').promises;

      try {
        const filePath = path.join(process.cwd(), 'uploads', this.storageConfig.bucket ?? '', storageKey);
        await fs.unlink(filePath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') {
          throw error;
        }
      }
      return;
    }

    // TODO: 实现S3/MinIO的删除
    throw new Error('S3/MinIO provider not implemented yet');
  }

  async getFileBuffer(storageKey: string): Promise<Buffer> {
    if (this.storageConfig.provider === 'local') {
        const fs = require('node:fs').promises;
        const filePath = path.join(process.cwd(), 'uploads', this.storageConfig.bucket ?? '', storageKey);
        return fs.readFile(filePath);
    }
    throw new Error('S3/MinIO provider not implemented yet');
  }

  resolveLocalPath(storageKey: string): string {
    if (this.storageConfig.provider !== 'local') {
      throw new Error('Local storage is not enabled');
    }
    return path.join(process.cwd(), 'uploads', this.storageConfig.bucket ?? '', storageKey);
  }

  /**
   * 获取文件元信息（宽度、高度等）
   */
  async getFileMetadata(storageKey: string): Promise<{ width?: number; height?: number }> {
    if (this.storageConfig.provider === 'local') {
      // 本地存储模式，直接读取文件
      const fs = require('node:fs').promises;
      const sharp = require('sharp');

      try {
        const filePath = path.join(process.cwd(), 'uploads', this.storageConfig.bucket ?? '', storageKey);
        const image = sharp(filePath);
        const metadata = await image.metadata();

        return {
          width: metadata.width,
          height: metadata.height,
        };
      } catch (error) {
        // 无法获取元信息，返回空对象
        return {};
      }
    }

    // TODO: 实现S3/MinIO的元信息获取
    throw new Error('S3/MinIO provider not implemented yet');
  }

  /**
   * 验证存储配置
   */
  validateConfig(): boolean {
    if (this.storageConfig.provider === 's3' || this.storageConfig.provider === 'minio') {
      return !!(
        this.storageConfig.bucket &&
        this.storageConfig.accessKey &&
        this.storageConfig.secretKey
      );
    }
    return true; // local provider always valid
  }

  private normalizeProvider(
    provider?: string | null
  ): 'local' | 's3' | 'minio' {
    if (!provider) return 'local';
    const normalized = provider.toLowerCase();
    if (normalized === 's3' || normalized === 'minio') {
      return normalized;
    }
    return 'local';
  }

  private normalizeEnv(env?: string | null) {
    if (!env) return 'dev';
    const normalized = env.toLowerCase();
    if (normalized === 'production') {
      return 'prod';
    }
    if (normalized === 'development') {
      return 'dev';
    }
    if (normalized === 'staging' || normalized === 'prod' || normalized === 'dev') {
      return normalized;
    }
    return 'dev';
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<{
    provider: string;
    bucket?: string;
    signedUrlExpiry: number;
  }> {
    return {
      provider: this.storageConfig.provider,
      bucket: this.storageConfig.bucket,
      signedUrlExpiry: this.storageConfig.signedUrlExpiry,
    };
  }
}
