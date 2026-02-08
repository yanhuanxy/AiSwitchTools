import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CharactersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createCharacter(params: {
    id: string;
    ownerUserId: string;
    name: string;
    bio: string | null;
    avatarAttachmentId: string | null;
  }) {
    return this.prisma.character.create({
      data: {
        id: params.id,
        ownerUserId: params.ownerUserId,
        name: params.name,
        bio: params.bio,
        avatarAttachmentId: params.avatarAttachmentId,
        visibility: 'private',
      },
    });
  }

  async listCharacters(params: {
    ownerUserId: string;
    limit: number;
    cursor?: { updatedAt: Date; id: string };
  }) {
    const cursorCondition = params.cursor
      ? {
          OR: [
            { updatedAt: { lt: params.cursor.updatedAt } },
            {
              updatedAt: params.cursor.updatedAt,
              id: { lt: params.cursor.id },
            },
          ],
        }
      : undefined;
    return this.prisma.character.findMany({
      where: {
        ownerUserId: params.ownerUserId,
        ...(cursorCondition ? { AND: cursorCondition } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: params.limit + 1,
    });
  }

  async findCharacterById(params: { ownerUserId: string; id: string }) {
    return this.prisma.character.findFirst({
      where: { ownerUserId: params.ownerUserId, id: params.id },
    });
  }
}
