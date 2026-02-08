import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import { Request } from "express";
import path from "node:path";
import { ulid } from "ulid";
import { UploadsRepository } from "./uploads.repository";
import { UploadsProvider } from "./uploads.provider";

type UploadedAttachment = {
  attachmentId: string;
  scanStatus: "pending";
  viewUrl: null;
  uploadUrl: null;
};

@Injectable()
export class UploadsService {
  private readonly inflightByUser = new Map<string, number>();

  constructor(
    @Inject(UploadsRepository) private readonly uploadsRepository: UploadsRepository,
    @Inject(UploadsProvider) private readonly uploadsProvider: UploadsProvider
  ) {}

  async uploadImages(request: Request, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException("INVALID_PARAMS");
    }
    if (files.length > 4) {
      throw new BadRequestException("INVALID_PARAMS");
    }

    const ownerUserId = this.getOwnerUserId(request);
    return this.withInflightLimit(ownerUserId, async () => {
      const items: UploadedAttachment[] = [];
      for (const file of files) {
        this.validateFile(file);
        const attachmentId = ulid();
        const extension = this.getExtension(file.mimetype);
        const storageKey = this.buildStorageKey(
          ownerUserId,
          attachmentId,
          file.originalname,
          extension
        );
        const { storageKey: savedStorageKey } = await this.uploadsProvider.saveFile({
          ownerUserId,
          attachmentId,
          buffer: file.buffer,
          extension,
          storageKey
        });
        await this.uploadsRepository.createAttachment({
          id: attachmentId,
          ownerUserId,
          storageKey: savedStorageKey,
          mime: file.mimetype,
          size: file.size
        });
        items.push({
          attachmentId,
          scanStatus: "pending",
          viewUrl: null,
          uploadUrl: null
        });
      }
      return { items };
    });
  }

  private getOwnerUserId(request: Request) {
    const userId = (request as { user?: { id?: string } }).user?.id;
    if (!userId) {
      throw new UnauthorizedException("AUTH_REQUIRED");
    }
    return userId;
  }

  private withInflightLimit<T>(userId: string, work: () => Promise<T>) {
    const current = this.inflightByUser.get(userId) ?? 0;
    if (current >= 3) {
      throw new HttpException("RATE_LIMITED", HttpStatus.TOO_MANY_REQUESTS);
    }
    this.inflightByUser.set(userId, current + 1);
    return work().finally(() => {
      const next = (this.inflightByUser.get(userId) ?? 1) - 1;
      if (next <= 0) {
        this.inflightByUser.delete(userId);
      } else {
        this.inflightByUser.set(userId, next);
      }
    });
  }

  private validateFile(file: Express.Multer.File) {
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException("INVALID_PARAMS");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException("INVALID_PARAMS");
    }
  }

  private getExtension(mime: string) {
    switch (mime) {
      case "image/jpeg":
        return "jpg";
      case "image/png":
        return "png";
      case "image/webp":
        return "webp";
      default:
        throw new BadRequestException("INVALID_PARAMS");
    }
  }

  private buildStorageKey(
    ownerUserId: string,
    attachmentId: string,
    originalName: string,
    extension: string
  ) {
    const safeName = this.sanitizeOriginalName(originalName, extension);
    return `${ownerUserId}/${attachmentId}_${safeName}`;
  }

  private sanitizeOriginalName(originalName: string, extension: string) {
    const fallback = `file.${extension}`;
    const rawName = originalName?.trim() ? originalName.trim() : fallback;
    const parsed = path.parse(rawName);
    const base = parsed.name || "file";
    const sanitizedBase = base
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    const safeBase = sanitizedBase || "file";
    return `${safeBase}.${extension}`;
  }
}
