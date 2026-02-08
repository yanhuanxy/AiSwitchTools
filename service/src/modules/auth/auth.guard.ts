import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { AuthProvider } from './auth.provider';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthProvider) private readonly authProvider: AuthProvider) {
    console.log('AuthGuard instantiated, authProvider:', !!authProvider);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let token = '';
    const authHeader = request.header('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length);
    } else if (request.query?.accessToken) {
      token = request.query.accessToken as string;
    } else if (request.query?.token) {
      token = request.query.token as string;
    }

    if (!token) {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    const payload = this.authProvider.verifyAccessToken(token);
    request.user = { id: payload.sub, identityType: payload.identityType };
    return true;
  }
}
