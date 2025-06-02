import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { CookieUtil } from './cookie.util';

export class JwtUtil {
  private static readonly ACCESS_TOKEN_EXPIRES_IN = '15m';
  private static readonly REFRESH_TOKEN_EXPIRES_IN = '7d';
  private static readonly REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';

  constructor(private readonly jwtService: JwtService) {}

  private cleanPayload(payload: any): any {
    const { exp, iat, nbf, ...cleanedPayload } = payload;
    return cleanedPayload;
  }

  async generateTokens(payload: any) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: JwtUtil.ACCESS_TOKEN_EXPIRES_IN,
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: JwtUtil.REFRESH_TOKEN_EXPIRES_IN,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  setRefreshTokenCookie(res: Response, refreshToken: string): void {
    CookieUtil.set(res, JwtUtil.REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  clearRefreshTokenCookie(res: Response): void {
    CookieUtil.clear(res, JwtUtil.REFRESH_TOKEN_COOKIE_NAME);
  }

  async verifyAccessToken(token: string) {
    try {
      return await this.jwtService.verifyAsync(token);
    } catch (error) {
      return null;
    }
  }

  async verifyRefreshToken(token: string) {
    try {
      return await this.jwtService.verifyAsync(token);
    } catch (error) {
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    if (!payload) {
      return null;
    }

    const cleanedPayload = this.cleanPayload(payload);

    return this.jwtService.signAsync(cleanedPayload, {
      expiresIn: JwtUtil.ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  async rotateTokens(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    if (!payload) {
      return null;
    }

    const cleanedPayload = this.cleanPayload(payload);

    return this.generateTokens(cleanedPayload);
  }
}
