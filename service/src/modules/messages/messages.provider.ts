import { BadRequestException, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';

@Injectable()
export class MessagesProvider {
  private readonly cursorTtlMs = 60 * 60 * 1000;

  encodeCursor(item: { createdAt: Date; id: string }) {
    const payload = JSON.stringify({
      createdAt: item.createdAt.toISOString(),
      id: item.id,
      exp: Date.now() + this.cursorTtlMs,
    });
    const signature = this.sign(payload);
    return Buffer.from(
      JSON.stringify({ data: payload, sig: signature }),
      'utf8',
    ).toString('base64');
  }

  decodeCursor(raw: string) {
    let decoded: string;
    try {
      decoded = Buffer.from(raw, 'base64').toString('utf8');
    } catch {
      throw new BadRequestException('INVALID_PARAMS');
    }
    let wrapper: { data?: string; sig?: string };
    try {
      wrapper = JSON.parse(decoded);
    } catch {
      throw new BadRequestException('INVALID_PARAMS');
    }
    if (!wrapper.data || !wrapper.sig) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const expectedSig = this.sign(wrapper.data);
    if (!this.isSignatureValid(wrapper.sig, expectedSig)) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    let payload: { createdAt?: string; id?: string; exp?: number };
    try {
      payload = JSON.parse(wrapper.data);
    } catch {
      throw new BadRequestException('INVALID_PARAMS');
    }
    if (!payload.createdAt || !payload.id || !payload.exp) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    if (payload.exp < Date.now()) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    const createdAt = new Date(payload.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      throw new BadRequestException('INVALID_PARAMS');
    }
    return { createdAt, id: payload.id };
  }

  private sign(data: string) {
    return crypto
      .createHmac('sha256', this.getCursorSecret())
      .update(data)
      .digest('hex');
  }

  private isSignatureValid(received: string, expected: string) {
    const receivedBuffer = Buffer.from(received, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  }

  private getCursorSecret() {
    const secret = process.env.PAGINATION_HMAC_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('PAGINATION_HMAC_SECRET_NOT_CONFIGURED');
      }
      return 'dev-cursor-secret';
    }
    return secret;
  }
}
