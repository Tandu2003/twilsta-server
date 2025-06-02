import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const clientIp = this.getClientIp(req);
    const key = `rate_limit:${clientIp}`;
    const windowMs = 1 * 60 * 1000; // 1 minute
    const maxRequests = 100; // Max requests per window

    try {
      // Get or create rate limit record
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);

      let rateLimitRecord = await this.prisma.rateLimitLog.findUnique({
        where: { key },
      });

      if (!rateLimitRecord) {
        // Create new record
        await this.prisma.rateLimitLog.create({
          data: {
            key,
            attempts: 1,
          },
        });
        return next();
      }

      // Check if we're within the time window
      if (rateLimitRecord.updatedAt < windowStart) {
        // Reset the counter for new window
        await this.prisma.rateLimitLog.update({
          where: { key },
          data: {
            attempts: 1,
            updatedAt: now,
          },
        });
        return next();
      }

      // Check if limit exceeded
      if (rateLimitRecord.attempts >= maxRequests) {
        throw new HttpException(
          {
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(
              (rateLimitRecord.updatedAt.getTime() + windowMs - now.getTime()) /
                1000,
            ),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment counter
      await this.prisma.rateLimitLog.update({
        where: { key },
        data: {
          attempts: rateLimitRecord.attempts + 1,
          updatedAt: now,
        },
      });

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If database error, allow the request to continue
      console.error('Rate limiter error:', error);
      next();
    }
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}
