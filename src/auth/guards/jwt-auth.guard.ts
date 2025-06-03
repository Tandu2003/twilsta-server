import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (err || !user) {
      // Kiểm tra nếu có refresh token trong cookie
      const refreshToken = request.cookies?.refreshToken;

      if (!refreshToken) {
        throw new UnauthorizedException(
          'Authentication required - no valid tokens found',
        );
      }

      // Nếu access token hết hạn nhưng có refresh token, báo client refresh
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException(
          'Access token expired - refresh required',
        );
      }

      throw (
        err || new UnauthorizedException('Access token is invalid or expired')
      );
    }
    return user;
  }
}
