import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UploadsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createAttachment(params: {
    id: string;
    ownerUserId: string;
    storageKey: string;
    mime: string;
    size: number;
  }) {
    return this.prisma.attachment.create({
      data: {
        id: params.id,
        ownerUserId: params.ownerUserId,
        type: "image",
        storageKey: params.storageKey,
        mime: params.mime,
        size: params.size,
        scanStatus: "pending"
      }
    });
  }
}
