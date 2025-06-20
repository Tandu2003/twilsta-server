import { Request, Response, NextFunction } from 'express';
import logger from './logger';

/**
 * Async handler wrapper to catch async errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Log the error with context
      logger.error('Async handler caught error:', {
        error,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });

      // Pass error to error handler middleware
      next(error);
    });
  };
};

/**
 * Safe async handler that never crashes the server
 */
export const safeAsyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      try {
        // Log the error with context
        logger.error('Safe async handler caught error:', {
          error,
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
        });

        // Check if response has already been sent
        if (res.headersSent) {
          logger.warn('Headers already sent, cannot send error response');
          return;
        }

        // Send a safe error response
        res.status(500).json({
          success: false,
          message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : error.message,
          timestamp: new Date().toISOString(),
        });
      } catch (handlerError) {
        logger.error('Error in safe async handler:', handlerError);

        // Last resort - try to send minimal response
        try {
          if (!res.headersSent) {
            res.status(500).end('Internal Server Error');
          }
        } catch (finalError) {
          logger.error('Failed to send final error response:', finalError);
        }
      }
    });
  };
};

export default asyncHandler;
