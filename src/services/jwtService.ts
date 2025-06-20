import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  verified: boolean;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class JWTService {
  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET!;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET!;
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error('JWT secrets must be provided in environment variables');
    }
  }
  /**
   * Generate access token
   */
  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'twilsta-api',
      audience: 'twilsta-client',
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token and store in database
   */
  async generateRefreshToken(
    userId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<string> {
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry));

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        userAgent,
        ipAddress,
        expiresAt,
      },
    });

    logger.info(`Generated refresh token for user: ${userId}`);
    return token;
  }

  /**
   * Generate both access and refresh tokens
   */
  async generateTokenPair(
    user: { id: string; username: string; email: string; verified: boolean },
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenPair> {
    const accessToken = this.generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      verified: user.verified,
    });

    const refreshToken = await this.generateRefreshToken(user.id, userAgent, ipAddress);

    return { accessToken, refreshToken };
  }
  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'twilsta-api',
        audience: 'twilsta-client',
      } as jwt.VerifyOptions) as JWTPayload;

      return decoded;
    } catch (error) {
      logger.debug('Access token verification failed:', error);
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<{
    valid: boolean;
    userId?: string;
    refreshTokenRecord?: any;
  }> {
    try {
      const refreshTokenRecord = await prisma.refreshToken.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              verified: true,
            },
          },
        },
      });

      if (!refreshTokenRecord) {
        return { valid: false };
      }

      // Check if token is expired
      if (refreshTokenRecord.expiresAt < new Date()) {
        // Clean up expired token
        await this.revokeRefreshToken(token);
        return { valid: false };
      }

      // Check if token is still valid
      if (!refreshTokenRecord.isValid) {
        return { valid: false };
      }

      return {
        valid: true,
        userId: refreshTokenRecord.userId,
        refreshTokenRecord,
      };
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      return { valid: false };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    newRefreshToken?: string;
    user?: any;
  }> {
    const verification = await this.verifyRefreshToken(refreshToken);

    if (!verification.valid || !verification.refreshTokenRecord) {
      return { success: false };
    }

    const user = verification.refreshTokenRecord.user;

    // Generate new access token
    const newAccessToken = this.generateAccessToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      verified: user.verified,
    });

    // Optionally rotate refresh token (recommended for security)
    // For now, we'll keep the same refresh token but update its last used time
    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { updatedAt: new Date() },
    });

    logger.info(`Refreshed access token for user: ${user.id}`);

    return {
      success: true,
      accessToken: newAccessToken,
      newRefreshToken: refreshToken, // Same token for now
      user,
    };
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshToken(token: string): Promise<boolean> {
    try {
      await prisma.refreshToken.delete({
        where: { token },
      });
      logger.info(`Revoked refresh token: ${token.substring(0, 8)}...`);
      return true;
    } catch (error) {
      logger.error('Failed to revoke refresh token:', error);
      return false;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllRefreshTokens(userId: string): Promise<boolean> {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: { userId },
      });
      logger.info(`Revoked ${result.count} refresh tokens for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to revoke all refresh tokens:', error);
      return false;
    }
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        logger.info(`Cleaned up ${result.count} expired refresh tokens`);
      }

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }

  /**
   * Get user's active refresh tokens
   */
  async getUserRefreshTokens(userId: string) {
    return prisma.refreshToken.findMany({
      where: {
        userId,
        isValid: true,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Parse expiry string to milliseconds
   */
  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000; // Default 7 days
    }
  }
}

export default new JWTService();
