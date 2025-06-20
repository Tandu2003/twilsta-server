import morgan from 'morgan';
import { Request, Response } from 'express';
import logger, { stream } from '../utils/logger';

// Define custom tokens
morgan.token('id', (req: Request) => req.ip);
morgan.token('url', (req: Request) => req.url);
morgan.token('body', (req: Request) => {
  // Only log body for specific routes and hide sensitive data
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const body = { ...req.body };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    sensitiveFields.forEach((field) => {
      if (body[field]) {
        body[field] = '[REDACTED]';
      }
    });

    return JSON.stringify(body);
  }
  return '';
});

// Custom format for detailed logging
const detailedFormat = ':id :method :url :status :res[content-length] - :response-time ms :body';

// Simple format for production
const simpleFormat = ':method :url :status :res[content-length] - :response-time ms';

// Create morgan middleware
export const requestLogger = morgan(
  process.env.NODE_ENV === 'production' ? simpleFormat : detailedFormat,
  {
    stream,
    skip: (req: Request, res: Response) => {
      // Skip logging for health checks in production
      if (process.env.NODE_ENV === 'production' && req.url === '/health') {
        return true;
      }
      return false;
    },
  },
);

// Custom request logging middleware for additional info
export const customRequestLogger = (req: Request, res: Response, next: any) => {
  const startTime = Date.now();

  // Log request start
  logger.info(`[REQUEST START] ${req.method} ${req.url} from ${req.ip}`);

  // Log request details in development
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      // Remove sensitive data
      ['password', 'token', 'secret', 'key'].forEach((field) => {
        if (sanitizedBody[field]) {
          sanitizedBody[field] = '[REDACTED]';
        }
      });
      logger.debug(`Body: ${JSON.stringify(sanitizedBody, null, 2)}`);
    }
  }

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function (data: any) {
    const duration = Date.now() - startTime;
    logger.info(
      `[REQUEST END] ${req.method} ${req.url} - Status: ${res.statusCode} - Duration: ${duration}ms`,
    );

    if (process.env.NODE_ENV !== 'production' && res.statusCode >= 400) {
      logger.debug(`Response: ${JSON.stringify(data, null, 2)}`);
    }

    return originalJson.call(this, data);
  };

  next();
};
