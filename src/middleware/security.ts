import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ResponseHelper } from '../utils/responseHelper';

/**
 * Security headers middleware
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
});

/**
 * Rate limiting middleware
 */
export const createRateLimit = (
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  max: number = 100, // limit each IP to 100 requests per windowMs
  message: string = 'Too many requests from this IP, please try again later',
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req: Request, res: Response) => {
      ResponseHelper.tooManyRequests(res, message);
    },
  });
};

/**
 * General rate limiter
 */
export const generalLimiter = createRateLimit();

/**
 * Strict rate limiter for auth routes
 */
export const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts, please try again after 15 minutes',
);

/**
 * API rate limiter
 */
export const apiLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  1000, // 1000 requests per 15 minutes
  'API rate limit exceeded',
);

/**
 * Request size limiter
 */
export const requestSizeLimiter = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    ResponseHelper.badRequest(
      res,
      'Request payload too large. Maximum size is 10MB',
    );
    return;
  }

  next();
};
