import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ulid } from 'ulid';
import { AuthRepository } from './auth.repository';
import { AuthProvider } from './auth.provider';
import { TokenResult } from './entities';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn = 15 * 60;
  private readonly refreshTokenTtlMs = 7 * 24 * 60 * 60 * 1000;
  private readonly magicLinkTtlMs = 10 * 60 * 1000;
  private readonly refreshLockTtlMs = 10 * 1000;

  constructor(
    @Inject(AuthRepository) private readonly authRepository: AuthRepository,
    @Inject(AuthProvider) private readonly authProvider: AuthProvider,
  ) {}

  async createAnon(deviceFingerprint?: string): Promise<TokenResult> {
    const userId = ulid();
    await this.authRepository.createUser(userId);
    await this.authRepository.createIdentity({
      userId,
      type: 'anon',
      identifierHash: userId,
    });
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    return this.issueTokens(user.id, 'anon', user.tokenVersion, undefined, deviceFingerprint);
  }

  async refreshToken(refreshToken: string, deviceFingerprint?: string): Promise<TokenResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    const tokenHash = this.authProvider.hashToken(refreshToken);
    const refreshRecord = await this.authRepository.findRefreshTokenByHash(tokenHash);
    if (!refreshRecord) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    const user = await this.authRepository.findUserById(refreshRecord.userId);
    if (!user) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    const lockAcquired = await this.authRepository.tryAcquireRefreshLock(
      user.id,
      this.refreshLockTtlMs,
    );
    if (!lockAcquired) {
      throw new HttpException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }
    try {
      const now = new Date();
      if (refreshRecord.status === 'rotated') {
        await this.authRepository.incrementTokenVersion(user.id);
        await this.authRepository.revokeAllRefreshTokens(user.id);
        throw new UnauthorizedException('AUTH_REQUIRED');
      }
      if (refreshRecord.status !== 'active') {
        throw new UnauthorizedException('AUTH_REQUIRED');
      }
      if (refreshRecord.expiresAt <= now) {
        await this.authRepository.markRefreshTokenExpired(refreshRecord.id);
        throw new UnauthorizedException('AUTH_REQUIRED');
      }
      await this.authRepository.markRefreshTokenRotated(refreshRecord.id);
      return this.issueTokens(
        user.id,
        'anon',
        user.tokenVersion,
        refreshRecord.id,
        deviceFingerprint,
      );
    } finally {
      await this.authRepository.releaseRefreshLock(user.id);
    }
  }

  async logout(accessToken: string) {
    const payload = this.authProvider.verifyAccessToken(accessToken);
    await this.authRepository.incrementTokenVersion(payload.sub);
    await this.authRepository.revokeAllRefreshTokens(payload.sub);
    return { ok: true };
  }

  async bumpTokenVersionForSensitiveChange(userId: string) {
    await this.authRepository.incrementTokenVersion(userId);
    await this.authRepository.revokeAllRefreshTokens(userId);
    return { ok: true };
  }

  async startMagicLink(email: string) {
    if (!email) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const token = this.authProvider.generateToken();
    const tokenHash = this.authProvider.hashToken(token);
    const expiresAt = new Date(Date.now() + this.magicLinkTtlMs);
    await this.authRepository.createMagicLinkToken({
      id: ulid(),
      email,
      tokenHash,
      expiresAt,
    });
    await this.authProvider.sendMagicLinkEmail(email, this.buildMagicLinkUrl(token));
    return { ok: true };
  }

  async consumeMagicLink(token: string, deviceFingerprint?: string): Promise<TokenResult> {
    if (!token) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    const tokenHash = this.authProvider.hashToken(token);
    const record = await this.authRepository.findMagicLinkTokenByHash(tokenHash);
    if (!record || record.consumedAt) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    if (record.expiresAt <= new Date()) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    await this.authRepository.consumeMagicLinkToken(record.id);
    const identifierHash = this.authProvider.hashToken(record.email);
    const existing = await this.authRepository.findIdentity({
      type: 'magicLink',
      identifierHash,
    });
    let userId = existing?.userId;
    if (!userId) {
      userId = ulid();
      await this.authRepository.createUser(userId);
      await this.authRepository.createIdentity({
        userId,
        type: 'magicLink',
        identifierHash,
      });
    }
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    return this.issueTokens(user.id, 'magicLink', user.tokenVersion, undefined, deviceFingerprint);
  }

  private async issueTokens(
    userId: string,
    identityType: 'anon' | 'magicLink' | 'email' | 'phone',
    tokenVersion: number,
    rotatedFromTokenId?: string,
    deviceFingerprint?: string,
  ): Promise<TokenResult> {
    const accessToken = this.authProvider.signAccessToken({
      userId,
      identityType,
      tokenVersion,
    });
    const rawRefreshToken = this.authProvider.generateToken();
    const refreshTokenHash = this.authProvider.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlMs);
    await this.authRepository.createRefreshToken({
      id: ulid(),
      userId,
      tokenHash: refreshTokenHash,
      expiresAt,
      rotatedFromTokenId,
      deviceFingerprint: deviceFingerprint ?? null,
    });
    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.accessTokenExpiresIn,
    };
  }

  private buildMagicLinkUrl(token: string) {
    const base =
      process.env.APP_PUBLIC_URL ||
      process.env.API_PUBLIC_URL ||
      `http://localhost:${process.env.PORT ? Number(process.env.PORT) : 3100}`;
    const trimmed = base.replace(/\/$/, '');
    return `${trimmed}/api/auth/magic-link/consume?token=${encodeURIComponent(token)}`;
  }
}
