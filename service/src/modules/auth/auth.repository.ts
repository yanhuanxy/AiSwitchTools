import { Injectable, Inject } from '@nestjs/common';
import { ulid } from 'ulid';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createUser(userId: string) {
    return this.prisma.user.create({ data: { id: userId } });
  }

  async createIdentity(params: {
    userId: string;
    type: 'anon' | 'magicLink' | 'email' | 'phone';
    identifierHash: string;
  }) {
    return this.prisma.userIdentity.create({
      data: {
        id: ulid(),
        userId: params.userId,
        type: params.type,
        identifierHash: params.identifierHash,
      },
    });
  }

  async findIdentity(params: {
    type: 'anon' | 'magicLink' | 'email' | 'phone';
    identifierHash: string;
  }) {
    return this.prisma.userIdentity.findUnique({
      where: {
        type_identifierHash: {
          type: params.type,
          identifierHash: params.identifierHash,
        },
      },
    });
  }

  async findUserById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  async incrementTokenVersion(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async revokeAllRefreshTokens(userId: string) {
    return this.prisma.userRefreshToken.updateMany({
      where: { userId, status: { in: ['active', 'rotated'] } },
      data: { status: 'revoked' },
    });
  }

  async createRefreshToken(params: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    rotatedFromTokenId?: string;
    deviceFingerprint?: string | null;
  }) {
    return this.prisma.userRefreshToken.create({
      data: {
        id: params.id,
        userId: params.userId,
        tokenHash: params.tokenHash,
        status: 'active',
        rotatedFromTokenId: params.rotatedFromTokenId ?? null,
        expiresAt: params.expiresAt,
        deviceFingerprint: params.deviceFingerprint ?? null,
      },
    });
  }

  async findRefreshTokenByHash(tokenHash: string) {
    return this.prisma.userRefreshToken.findFirst({
      where: { tokenHash },
    });
  }

  async markRefreshTokenRotated(id: string) {
    return this.prisma.userRefreshToken.update({
      where: { id },
      data: { status: 'rotated', lastUsedAt: new Date() },
    });
  }

  async markRefreshTokenExpired(id: string) {
    return this.prisma.userRefreshToken.update({
      where: { id },
      data: { status: 'expired', lastUsedAt: new Date() },
    });
  }

  async tryAcquireRefreshLock(userId: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const expiresAt = new Date(now + ttlMs);
    try {
      await (this.prisma as any).refreshLock.create({
        data: { userId, expiresAt },
      });
      return true;
    } catch (err: any) {
      const existing = await (this.prisma as any).refreshLock.findUnique({
        where: { userId },
      });
      if (!existing) {
        return false;
      }
      if (existing.expiresAt <= new Date()) {
        await (this.prisma as any).refreshLock.delete({ where: { userId } });
        try {
          await (this.prisma as any).refreshLock.create({
            data: { userId, expiresAt },
          });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  async releaseRefreshLock(userId: string): Promise<void> {
    try {
      await (this.prisma as any).refreshLock.delete({ where: { userId } });
    } catch {
    }
  }

  async createMagicLinkToken(params: {
    id: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.magicLinkToken.create({
      data: {
        id: params.id,
        email: params.email,
        tokenHash: params.tokenHash,
        purpose: 'login',
        expiresAt: params.expiresAt,
      },
    });
  }

  async findMagicLinkTokenByHash(tokenHash: string) {
    return this.prisma.magicLinkToken.findFirst({
      where: { tokenHash },
    });
  }

  async consumeMagicLinkToken(id: string) {
    return this.prisma.magicLinkToken.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}
