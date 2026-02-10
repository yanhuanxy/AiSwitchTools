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
    search?: string;
    favorites?: boolean;
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

    const where: any = {
      ...(cursorCondition ? { AND: cursorCondition } : {}),
    };

    if (params.favorites) {
      where.favorites = {
        some: {
          userId: params.ownerUserId,
        },
      };
    } else {
      where.ownerUserId = params.ownerUserId;
    }

    if (params.search) {
      where.name = { contains: params.search };
    }

    return this.prisma.character.findMany({
      where,
      include: {
        favorites: {
          where: { userId: params.ownerUserId },
          select: { userId: true },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: params.limit + 1,
    });
  }

  async toggleFavorite(params: { userId: string; characterId: string }) {
    const existing = await this.prisma.characterFavorite.findUnique({
      where: {
        userId_characterId: {
          userId: params.userId,
          characterId: params.characterId,
        },
      },
    });

    if (existing) {
      await this.prisma.characterFavorite.delete({
        where: {
          userId_characterId: {
            userId: params.userId,
            characterId: params.characterId,
          },
        },
      });
      return false;
    } else {
      await this.prisma.characterFavorite.create({
        data: {
          userId: params.userId,
          characterId: params.characterId,
        },
      });
      return true;
    }
  }

  async findCharacterById(params: { ownerUserId: string; id: string }) {
    return this.prisma.character.findFirst({
      where: { ownerUserId: params.ownerUserId, id: params.id },
    });
  }
}
