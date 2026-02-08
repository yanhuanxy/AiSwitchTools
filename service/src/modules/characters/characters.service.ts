import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { ulid } from 'ulid';
import { CharactersRepository } from './characters.repository';
import { CreateCharacterDto } from './dto';
import { MessagesProvider } from '../messages/messages.provider';
import { AttachmentsService } from '../attachments/attachments.service';

type CharacterRecord = {
  id: string;
  name: string;
  bio: string | null;
  avatarAttachmentId: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class CharactersService {
  constructor(
    @Inject(CharactersRepository) private readonly charactersRepository: CharactersRepository,
    @Inject(MessagesProvider) private readonly messagesProvider: MessagesProvider,
    @Inject(AttachmentsService) private readonly attachmentsService: AttachmentsService,
  ) {}

  async createCharacter(request: Request, body: CreateCharacterDto) {
    const ownerUserId = this.getOwnerUserId(request);
    const name = body.name?.trim() ?? '';
    if (!name || name.length > 30) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const bio =
      body.bio === undefined || body.bio === null ? null : String(body.bio);
    if (bio !== null && bio.length > 120) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const avatarAttachmentId =
      body.avatarAttachmentId === undefined ||
      body.avatarAttachmentId === null ||
      body.avatarAttachmentId === ''
        ? null
        : String(body.avatarAttachmentId);

    if (avatarAttachmentId) {
      try {
        const attachment = await this.attachmentsService.getAttachment(
          avatarAttachmentId,
          ownerUserId,
        );
        if (attachment.scanStatus !== 'passed') {
          throw new BadRequestException('Avatar attachment not passed scan');
        }
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new BadRequestException('Invalid avatar attachment');
        }
        throw error;
      }
    }

    const id = ulid();
    await this.charactersRepository.createCharacter({
      id,
      ownerUserId,
      name,
      bio,
      avatarAttachmentId,
    });
    return { id };
  }

  async listCharacters(
    request: Request,
    query: { limit?: string; cursor?: string },
  ) {
    const ownerUserId = this.getOwnerUserId(request);
    const limit = this.parseLimit(query.limit);
    const cursor = query.cursor ? this.parseCursor(query.cursor) : undefined;
    const items = await this.charactersRepository.listCharacters({
      ownerUserId,
      limit,
      cursor,
    });
    const hasMore = items.length > limit;
    const slice = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore
      ? this.encodeCursor(slice[slice.length - 1])
      : null;
    return {
      items: slice.map((item: CharacterRecord) => ({
        id: item.id,
        name: item.name,
        bio: item.bio ?? undefined,
        avatarAttachmentId: item.avatarAttachmentId ?? undefined,
        visibility: 'private',
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async getCharacter(request: Request, id: string) {
    const ownerUserId = this.getOwnerUserId(request);
    if (!id) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const character = await this.charactersRepository.findCharacterById({
      ownerUserId,
      id,
    });
    if (!character) {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    return {
      id: character.id,
      name: character.name,
      bio: character.bio ?? undefined,
      avatarAttachmentId: character.avatarAttachmentId ?? undefined,
      visibility: 'private',
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString(),
    };
  }

  private getOwnerUserId(request: Request) {
    const userId = (request as any).user?.id;
    if (!userId) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    return userId;
  }

  private parseLimit(raw?: string) {
    if (!raw) {
      return 20;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    return Math.min(Math.floor(parsed), 100);
  }

  private parseCursor(raw: string) {
    const decoded = this.messagesProvider.decodeCursor(raw);
    return { updatedAt: decoded.createdAt, id: decoded.id };
  }

  private encodeCursor(item: { updatedAt: Date; id: string }) {
    return this.messagesProvider.encodeCursor({
      createdAt: item.updatedAt,
      id: item.id,
    });
  }
}
