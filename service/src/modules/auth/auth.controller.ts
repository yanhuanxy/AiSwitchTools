import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  ValidationPipe,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import crypto from 'node:crypto';
import { AuthService } from './auth.service';
import { MagicLinkStartDto, RefreshTokenDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('anon')
  async createAnon(@Req() request: Request) {
    const result = await this.authService.createAnon(this.buildDeviceFingerprint(request));
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  @Post('token/refresh')
  async refreshToken(@Body(ValidationPipe) body: RefreshTokenDto, @Req() request: Request) {
    const result = await this.authService.refreshToken(
      body.refreshToken,
      this.buildDeviceFingerprint(request),
    );
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  @Post('logout')
  async logout(@Req() request: Request) {
    const authHeader = request.header('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : '';
    if (!token) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    const result = await this.authService.logout(token);
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  @Post('magic-link/start')
  async magicLinkStart(@Body(ValidationPipe) body: MagicLinkStartDto, @Req() request: Request) {
    const result = await this.authService.startMagicLink(body.email);
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  @Get('magic-link/consume')
  async magicLinkConsume(@Query('token') token: string | undefined, @Req() request: Request) {
    const result = await this.authService.consumeMagicLink(
      token ?? '',
      this.buildDeviceFingerprint(request),
    );
    const traceId = request.headers['x-trace-id'] as string;
    return { ...result, traceId };
  }

  private buildDeviceFingerprint(req: Request): string {
    const ua = req.headers['user-agent'] || '';
    const lang = req.headers['accept-language'] || '';
    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      '';
    const raw = `${ua}|${lang}|${ip}`;
    return crypto.createHash('sha1').update(raw).digest('hex');
  }
}
