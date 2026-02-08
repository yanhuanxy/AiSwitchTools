import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { ulid } from 'ulid';

@Injectable()
export class AuthProvider {
  private rateLimitPerSecond: number;

  constructor() {
    console.log('AuthProvider instantiated');
    // Mock config or use process.env
    this.rateLimitPerSecond = 5; 
  }

  signAccessToken(params: {
    userId: string;
    identityType: 'anon' | 'magicLink' | 'email' | 'phone';
    tokenVersion: number;
  }) {
    const alg = this.getJwtAlg();
    const payload = {
      sub: params.userId,
      identityType: params.identityType,
      tokenVersion: params.tokenVersion,
    };
    if (alg === 'RS256') {
      const { privateKey } = this.getJwtKeyPair();
      return jwt.sign(payload, privateKey, { expiresIn: '15m', algorithm: 'RS256' });
    }
    const secret = this.getJwtSecret();
    return jwt.sign(payload, secret, { expiresIn: '15m', algorithm: 'HS256' });
  }

  verifyAccessToken(token: string) {
    const alg = this.getJwtAlg();
    let verified: any;
    if (alg === 'RS256') {
      const { publicKey } = this.getJwtKeyPair();
      verified = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    } else {
      const secret = this.getJwtSecret();
      verified = jwt.verify(token, secret, { algorithms: ['HS256'] });
    }
    return verified as {
      sub: string;
      identityType: 'anon' | 'magicLink' | 'email' | 'phone';
      tokenVersion: number;
    };
  }

  hashToken(raw: string) {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  generateToken() {
    return `${ulid()}${crypto.randomBytes(16).toString('hex')}`;
  }

  private getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET_NOT_CONFIGURED');
      }
      return 'dev-secret';
    }
    return secret;
  }

  private getJwtAlg(): 'HS256' | 'RS256' {
    const alg = (process.env.JWT_ALG || 'HS256').toUpperCase();
    if (alg === 'RS256') {
      return 'RS256';
    }
    return 'HS256';
  }

  private getJwtKeyPair(): { privateKey: string; publicKey: string } {
    const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH || '';
    const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || '';
    if (privateKeyPath && publicKeyPath) {
      try {
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
        if (privateKey && publicKey) {
          return { privateKey, publicKey };
        }
      } catch {}
    }

    const privateKey = process.env.JWT_PRIVATE_KEY || '';
    const publicKey = process.env.JWT_PUBLIC_KEY || '';
    if (!privateKey || !publicKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_KEYPAIR_NOT_CONFIGURED');
      }
      const { generateKeyPairSync } = crypto;
      const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const pkcs8 = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const spki = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
      return { privateKey: pkcs8, publicKey: spki };
    }
    return { privateKey, publicKey };
  }

  async sendMagicLinkEmail(to: string, url: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || 'no-reply@example.com';
    if (!apiKey || !from) {
      return;
    }
    const subject = process.env.RESEND_MAGIC_LINK_SUBJECT || '登录魔法链接';
    const html = `<p>点击下方链接登录：</p><p><a href="${url}">${url}</a></p>`;
    const text = `点击链接登录：\n${url}`;
    const primaryTemplateId = process.env.RESEND_MAGIC_LINK_TEMPLATE_ID_PRIMARY;
    const secondaryTemplateId = process.env.RESEND_MAGIC_LINK_TEMPLATE_ID_SECONDARY;
    const variant = (process.env.RESEND_MAGIC_LINK_TEMPLATE_VARIANT || 'primary').toLowerCase();
    const templateId =
      variant === 'secondary' ? secondaryTemplateId : primaryTemplateId;
    try {
      const fetchFn: any = (globalThis as any).fetch;
      if (!fetchFn) {
        return;
      }
      const payload = templateId
        ? {
            from,
            to,
            subject,
            template_id: templateId,
            template_data: { url },
          }
        : {
            from,
            to,
            subject,
            html,
            text,
          };
      await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
    }
  }
}
