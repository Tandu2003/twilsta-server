import { Response } from 'express';

export class CookieUtil {
  private static readonly DEFAULT_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };

  static set(
    res: Response,
    name: string,
    value: string,
    options: {
      maxAge?: number;
      domain?: string;
      path?: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
    } = {},
  ): void {
    const cookieOptions = {
      ...this.DEFAULT_OPTIONS,
      ...options,
    };

    res.cookie(name, value, cookieOptions);
  }

  static get(req: any, name: string): string | undefined {
    return req.cookies[name];
  }

  static clear(
    res: Response,
    name: string,
    options: { path?: string } = {},
  ): void {
    const cookieOptions = {
      ...this.DEFAULT_OPTIONS,
      ...options,
      maxAge: 0,
    };

    res.clearCookie(name, cookieOptions);
  }

  static setAuthCookie(
    res: Response,
    token: string,
    maxAge: number = 7 * 24 * 60 * 60 * 1000, // 7 days
  ): void {
    this.set(res, 'auth_token', token, {
      maxAge,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }

  static clearAuthCookie(res: Response): void {
    this.clear(res, 'auth_token', { path: '/' });
  }
}
